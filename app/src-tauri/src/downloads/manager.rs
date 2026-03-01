use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use super::db::{DownloadDb, DownloadQuality, DownloadRecord, DownloadStatus};
use super::events::{emit_progress, emit_status, ProgressPayload, StatusPayload};
use super::file_store;
use super::hls;
use super::notifier;

/// Payload sent from the frontend to start a new download.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadPayload {
    pub profile_id: String,
    pub media_type: String,
    pub media_id: String,
    pub episode_id: Option<String>,
    pub title: String,
    pub episode_title: Option<String>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub poster_path: String,
    pub stream_url: String,
    pub addon_id: String,
    pub quality: String,
    /// Override smart download flag (None = use profile default)
    pub smart_download: Option<bool>,
    /// Override auto-delete flag (None = use profile default)
    pub auto_delete: Option<bool>,
}

/// Lightweight queue item held in memory.
#[derive(Debug, Clone)]
struct QueueItem {
    id: String,
    profile_id: String,
    title: String,
    stream_url: String,
    quality: String,
    smart_download: bool,
    auto_delete: bool,
}

/// Shared state managed across Tauri commands.
pub struct DownloadManager {
    db: Arc<Mutex<DownloadDb>>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    active: Arc<Mutex<Vec<String>>>,     // IDs of currently running downloads
    paused: Arc<Mutex<Vec<String>>>,     // IDs that have been paused
    max_concurrent: usize,
}

impl DownloadManager {
    pub fn new(db: DownloadDb) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            queue: Arc::new(Mutex::new(VecDeque::new())),
            active: Arc::new(Mutex::new(Vec::new())),
            paused: Arc::new(Mutex::new(Vec::new())),
            max_concurrent: 2,
        }
    }

    /// Enqueues a download and starts it if capacity is available.
    pub fn enqueue(&self, app: AppHandle, payload: StartDownloadPayload) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        file_store::ensure_dir(&app, &payload.profile_id).map_err(|e| e.to_string())?;

        let file_path = file_store::download_file_path(&app, &payload.profile_id, &id)
            .to_string_lossy()
            .to_string();

        // Resolve smart download and auto-delete flags: explicit override > profile default > false
        let (profile_smart, profile_auto_delete) = self.db.lock().unwrap()
            .get_smart_defaults(&payload.profile_id)
            .unwrap_or((false, false));
        let smart_download = payload.smart_download.unwrap_or(profile_smart);
        let auto_delete = payload.auto_delete.unwrap_or(profile_auto_delete);

        let record = DownloadRecord {
            id: id.clone(),
            profile_id: payload.profile_id.clone(),
            media_type: payload.media_type.clone(),
            media_id: payload.media_id.clone(),
            episode_id: payload.episode_id.clone(),
            title: payload.title.clone(),
            episode_title: payload.episode_title.clone(),
            season: payload.season,
            episode: payload.episode,
            poster_path: payload.poster_path.clone(),
            status: DownloadStatus::Queued,
            progress: 0.0,
            quality: DownloadQuality::from_str(&payload.quality),
            file_path: file_path.clone(),
            file_size: 0,
            downloaded_bytes: 0,
            added_at: now,
            completed_at: None,
            last_watched_at: None,
            watched_percent: 0.0,
            stream_url: payload.stream_url.clone(),
            addon_id: payload.addon_id.clone(),
            error_message: None,
            smart_download,
            auto_delete,
        };

        self.db.lock().unwrap().insert(&record).map_err(|e| e.to_string())?;

        let item = QueueItem {
            id: id.clone(),
            profile_id: payload.profile_id.clone(),
            title: payload.title.clone(),
            stream_url: payload.stream_url.clone(),
            quality: payload.quality.clone(),
            smart_download,
            auto_delete,
        };

        self.queue.lock().unwrap().push_back(item);
        self.try_start_next(app);

        Ok(id)
    }

    /// Tries to start the next queued download if below max_concurrent.
    fn try_start_next(&self, app: AppHandle) {
        let active_count = self.active.lock().unwrap().len();
        if active_count >= self.max_concurrent {
            return;
        }

        let item = {
            let mut q = self.queue.lock().unwrap();
            q.pop_front()
        };

        if let Some(item) = item {
            // Mark as active
            self.active.lock().unwrap().push(item.id.clone());

            let db = Arc::clone(&self.db);
            let active = Arc::clone(&self.active);
            let queue = Arc::clone(&self.queue);
            let paused = Arc::clone(&self.paused);
            let app_clone = app.clone();
            let id = item.id.clone();
            let title = item.title.clone();
            let profile_id = item.profile_id.clone();
            let stream_url = item.stream_url.clone();
            let quality = item.quality.clone();
            let smart_download = item.smart_download;
            let auto_delete_on_done = item.auto_delete;
            let max_concurrent = self.max_concurrent;

            tauri::async_runtime::spawn(async move {
                let result = run_download(
                    app_clone.clone(),
                    db.clone(),
                    paused.clone(),
                    &id,
                    &profile_id,
                    &title,
                    &stream_url,
                    &quality,
                )
                .await;

                // Remove from active when done
                active.lock().unwrap().retain(|a| a != &id);

                if result.is_ok() && smart_download {
                    smart_download_hook(
                        app_clone.clone(),
                        db.clone(),
                        paused.clone(),
                        &id,
                        auto_delete_on_done,
                    ).await;
                }

                // Try to start the next one
                let next_active = active.lock().unwrap().len();
                if next_active < max_concurrent {
                    let next_item = queue.lock().unwrap().pop_front();
                    if let Some(next) = next_item {
                        active.lock().unwrap().push(next.id.clone());
                        let db2 = Arc::clone(&db);
                        let active2 = Arc::clone(&active);
                        let paused2 = Arc::clone(&paused);
                        let app2 = app_clone.clone();
                        let next_quality = next.quality.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = run_download(
                                app2.clone(),
                                db2,
                                paused2,
                                &next.id,
                                &next.profile_id,
                                &next.title,
                                &next.stream_url,
                                &next_quality,
                            ).await;
                            active2.lock().unwrap().retain(|a| a != &next.id);
                        });
                    }
                }
            });
        }
    }

    pub fn pause(&self, app: AppHandle, id: &str) -> Result<(), String> {
        self.paused.lock().unwrap().push(id.to_string());
        self.db.lock().unwrap()
            .update_status(id, &DownloadStatus::Paused)
            .map_err(|e| e.to_string())?;
        emit_status(&app, StatusPayload {
            id: id.to_string(),
            status: "paused".into(),
            file_path: None,
            error: None,
        });
        Ok(())
    }

    pub fn resume(&self, app: AppHandle, id: &str) -> Result<(), String> {
        // Remove from paused list, re-queue
        self.paused.lock().unwrap().retain(|p| p != id);
        
        let rec = self.db.lock().unwrap()
            .get_by_id(id)
            .map_err(|e| e.to_string())?
            .ok_or("Download not found")?;

        self.db.lock().unwrap()
            .update_status(id, &DownloadStatus::Queued)
            .map_err(|e| e.to_string())?;

        let item = QueueItem {
            id: rec.id.clone(),
            profile_id: rec.profile_id.clone(),
            title: rec.title.clone(),
            stream_url: rec.stream_url.clone(),
            quality: rec.quality.as_str().to_string(),
            smart_download: rec.smart_download,
            auto_delete: rec.auto_delete,
        };
        self.queue.lock().unwrap().push_front(item);
        self.try_start_next(app);
        Ok(())
    }

    pub fn cancel(&self, app: AppHandle, id: &str) -> Result<(), String> {
        self.paused.lock().unwrap().push(id.to_string()); // treat as paused so worker exits
        self.queue.lock().unwrap().retain(|q| q.id != id);
        self.db.lock().unwrap()
            .update_status(id, &DownloadStatus::Cancelled)
            .map_err(|e| e.to_string())?;
        emit_status(&app, StatusPayload {
            id: id.to_string(),
            status: "cancelled".into(),
            file_path: None,
            error: None,
        });
        Ok(())
    }

    pub fn delete(&self, app: AppHandle, id: &str) -> Result<(), String> {
        let rec = self.db.lock().unwrap()
            .get_by_id(id)
            .map_err(|e| e.to_string())?;

        if let Some(rec) = rec {
            file_store::delete_files(&app, &rec.profile_id, id);
        }
        self.queue.lock().unwrap().retain(|q| q.id != id);
        self.paused.lock().unwrap().retain(|p| p != id);
        self.active.lock().unwrap().retain(|a| a != id);
        self.db.lock().unwrap().delete(id).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_downloads(&self, profile_id: &str) -> Result<Vec<DownloadRecord>, String> {
        self.db.lock().unwrap()
            .get_all(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn get_storage_stats(&self, profile_id: &str) -> Result<(i64, i64), String> {
        self.db.lock().unwrap()
            .get_storage_stats(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn get_quota(&self, profile_id: &str) -> Result<i64, String> {
        self.db.lock().unwrap().get_quota(profile_id).map_err(|e| e.to_string())
    }

    pub fn set_quota(&self, profile_id: &str, quota_bytes: i64) -> Result<(), String> {
        self.db.lock().unwrap().set_quota(profile_id, quota_bytes).map_err(|e| e.to_string())
    }

    pub fn get_smart_defaults(&self, profile_id: &str) -> Result<(bool, bool), String> {
        self.db.lock().unwrap().get_smart_defaults(profile_id).map_err(|e| e.to_string())
    }

    pub fn set_smart_defaults(&self, profile_id: &str, smart: bool, auto_delete: bool) -> Result<(), String> {
        self.db.lock().unwrap().set_smart_defaults(profile_id, smart, auto_delete).map_err(|e| e.to_string())
    }

    pub fn delete_all_for_profile(&self, app: AppHandle, profile_id: &str) -> Result<(), String> {
        let ids = self.db.lock().unwrap()
            .delete_all_for_profile(profile_id)
            .map_err(|e| e.to_string())?;
        for id in ids {
            file_store::delete_files(&app, profile_id, &id);
        }
        Ok(())
    }
}

/// Post-completion hook for Smart Downloads.
/// Looks up the next episode and enqueues it; optionally deletes the current file.
async fn smart_download_hook(
    app: AppHandle,
    db: Arc<Mutex<DownloadDb>>,
    paused: Arc<Mutex<Vec<String>>>,
    completed_id: &str,
    auto_delete: bool,
) {
    // Try to find the next episode
    let next = db.lock().unwrap().get_next_episode(completed_id);
    let next_ep = match next {
        Ok(Some(ep)) => ep,
        _ => return, // No next episode or error — done
    };

    let title = next_ep.episode_title.clone().unwrap_or_else(|| next_ep.title.clone());
    eprintln!("[SmartDownloads] Queuing next episode: {}", title);

    // Assign a real ID, file path, and enqueue
    let new_id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let file_path = file_store::download_file_path(&app, &next_ep.profile_id, &new_id)
        .to_string_lossy()
        .to_string();
    file_store::ensure_dir(&app, &next_ep.profile_id).ok();

    let record = super::db::DownloadRecord {
        id: new_id.clone(),
        profile_id: next_ep.profile_id.clone(),
        media_type: next_ep.media_type.clone(),
        media_id: next_ep.media_id.clone(),
        episode_id: next_ep.episode_id.clone(),
        title: next_ep.title.clone(),
        episode_title: next_ep.episode_title.clone(),
        season: next_ep.season,
        episode: next_ep.episode,
        poster_path: next_ep.poster_path.clone(),
        status: super::db::DownloadStatus::Queued,
        progress: 0.0,
        quality: next_ep.quality.clone(),
        file_path,
        file_size: 0,
        downloaded_bytes: 0,
        added_at: now,
        completed_at: None,
        last_watched_at: None,
        watched_percent: 0.0,
        stream_url: next_ep.stream_url.clone(),
        addon_id: next_ep.addon_id.clone(),
        error_message: None,
        smart_download: true,
        auto_delete: next_ep.auto_delete,
    };

    if db.lock().unwrap().insert(&record).is_err() {
        return;
    }

    // Optionally delete the now-completed file to free up space
    if auto_delete {
        file_store::delete_files(&app, &next_ep.profile_id, completed_id);
        db.lock().unwrap().delete(completed_id).ok();
    }

    // Kick off the new download
    let _ = run_download(
        app,
        db,
        paused,
        &new_id,
        &next_ep.profile_id,
        &title,
        &next_ep.stream_url,
        next_ep.quality.as_str(),
    ).await;
}

/// The async task that actually downloads a file.
/// Detects stream format by URL and routes to the appropriate engine.
async fn run_download(
    app: AppHandle,
    db: Arc<Mutex<DownloadDb>>,
    paused: Arc<Mutex<Vec<String>>>,
    id: &str,
    profile_id: &str,
    title: &str,
    stream_url: &str,
    quality: &str,
) -> Result<(), String> {
    // Route HLS streams to the dedicated engine
    let url_lower = stream_url.to_lowercase();
    if url_lower.contains(".m3u8") || url_lower.contains("m3u8") {
        return hls::download_hls(
            app, db, paused, id, profile_id, title, stream_url, quality,
        ).await;
    }
    let client = Client::builder()
        .user_agent("Zentrio/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let part_path = file_store::part_file_path(&app, profile_id, id);
    let final_path = file_store::download_file_path(&app, profile_id, id);

    // Check how much we already have (resume support)
    let start_byte = if part_path.exists() {
        file_store::file_size(&part_path)
    } else {
        0
    };

    let mut req = client.get(stream_url);
    if start_byte > 0 {
        req = req.header("Range", format!("bytes={}-", start_byte));
    }

    let response = req.send().await.map_err(|e| {
        db.lock().unwrap().update_error(id, &e.to_string()).ok();
        emit_status(&app, StatusPayload { id: id.to_string(), status: "failed".into(), file_path: None, error: Some(e.to_string()) });
        notifier::notify_failed(&app, title);
        e.to_string()
    })?;

    let total_size = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<i64>().ok())
        .map(|s| s + start_byte)
        .unwrap_or(0);

    // Open part file in append mode
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut downloaded = start_byte;
    let mut last_progress = -10.0_f64;
    let mut last_notif_progress: u8 = 0;
    let mut last_notif_time = Instant::now();
    let speed_window = Instant::now();
    let mut bytes_since_window: i64 = 0;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        // Check if paused/cancelled
        if paused.lock().unwrap().contains(&id.to_string()) {
            file.flush().await.ok();
            return Ok(());
        }

        let chunk = chunk.map_err(|e| {
            db.lock().unwrap().update_error(id, &e.to_string()).ok();
            emit_status(&app, StatusPayload { id: id.to_string(), status: "failed".into(), file_path: None, error: Some(e.to_string()) });
            notifier::notify_failed(&app, title);
            e.to_string()
        })?;

        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as i64;
        bytes_since_window += chunk.len() as i64;

        let progress = if total_size > 0 {
            (downloaded as f64 / total_size as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        // Emit progress event only every ~1% change or 1s
        if (progress - last_progress) >= 1.0 {
            last_progress = progress;
            db.lock().unwrap().update_progress(id, progress, downloaded).ok();

            let elapsed_secs = speed_window.elapsed().as_secs_f64().max(0.001);
            let speed = bytes_since_window as f64 / elapsed_secs;

            emit_progress(&app, ProgressPayload {
                id: id.to_string(),
                progress,
                downloaded_bytes: downloaded,
                speed,
            });

            // OS notification every 10% or every 30 seconds
            let progress_u8 = progress as u8;
            let should_notify = progress_u8 / 10 > last_notif_progress / 10
                || last_notif_time.elapsed().as_secs() >= 30;

            if should_notify {
                last_notif_progress = progress_u8;
                last_notif_time = Instant::now();
                notifier::notify_progress(&app, id, title, progress_u8, speed / 1024.0);
            }
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Rename part file to final
    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| e.to_string())?;

    let size = file_store::file_size(&final_path);
    db.lock().unwrap()
        .update_complete(id, &final_path.to_string_lossy(), size)
        .ok();

    emit_status(&app, StatusPayload {
        id: id.to_string(),
        status: "completed".into(),
        file_path: Some(final_path.to_string_lossy().to_string()),
        error: None,
    });

    notifier::notify_complete(&app, title);

    Ok(())
}
