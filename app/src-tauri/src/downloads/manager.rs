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
use super::events::{
    emit_progress, emit_smart_next, emit_status, ProgressPayload, SmartNextPayload, StatusPayload,
};
use super::file_store;
use super::hls;
use super::notifier;
use super::subtitles::SubtitleEntry;

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
    /// Subtitle tracks from the stream response — downloaded alongside the video
    pub subtitle_urls: Option<Vec<SubtitleEntry>>,
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
    /// JSON string of subtitle URLs (serialized for cheap cloning)
    subtitle_urls_json: Option<String>,
}

/// Shared state managed across Tauri commands.
pub struct DownloadManager {
    db: Arc<Mutex<DownloadDb>>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    active: Arc<Mutex<Vec<String>>>,
    paused: Arc<Mutex<Vec<String>>>,
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

    /// Re-queues any downloads that were interrupted by a crash or clean shutdown.
    /// Call once after construction, before the app is fully running.
    pub fn restore(&self, app: AppHandle) {
        let db = match self.db.lock() {
            Ok(d) => d,
            Err(_) => return,
        };

        // Reset any stuck 'downloading' rows back to 'queued' with zeroed progress
        // so they restart cleanly rather than resuming from a potentially corrupt offset.
        if let Err(e) = db.reset_interrupted() {
            log::warn!("[Downloads] Failed to reset interrupted downloads: {e}");
        }

        let pending = match db.get_all_pending() {
            Ok(p) => p,
            Err(e) => {
                log::warn!("[Downloads] Failed to load pending downloads on restore: {e}");
                return;
            }
        };
        drop(db);

        if pending.is_empty() {
            return;
        }

        log::info!(
            "[Downloads] Restoring {} pending download(s) from previous session",
            pending.len()
        );

        let mut queue = match self.queue.lock() {
            Ok(q) => q,
            Err(_) => return,
        };
        for rec in pending {
            queue.push_back(QueueItem {
                id: rec.id,
                profile_id: rec.profile_id,
                title: rec.title,
                stream_url: rec.stream_url,
                quality: rec.quality.as_str().to_string(),
                smart_download: rec.smart_download,
                auto_delete: rec.auto_delete,
                subtitle_urls_json: rec.subtitle_urls,
            });
        }
        drop(queue);

        self.try_start_next(app);
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

        let db = self.db.lock().map_err(|_| "DB lock poisoned".to_string())?;

        // Enforce storage quota before inserting
        let quota = db
            .get_quota(&payload.profile_id)
            .map_err(|e| e.to_string())?;
        if quota > 0 {
            let (used, _) = db
                .get_storage_stats(&payload.profile_id)
                .map_err(|e| e.to_string())?;
            if used >= quota {
                return Err(format!(
                    "Storage quota exceeded: using {} of {} bytes",
                    used, quota
                ));
            }
        }

        // Resolve smart download and auto-delete flags: explicit override > profile default > false
        let (profile_smart, profile_auto_delete) = db
            .get_smart_defaults(&payload.profile_id)
            .unwrap_or((false, false));
        let smart_download = payload.smart_download.unwrap_or(profile_smart);
        let auto_delete = payload.auto_delete.unwrap_or(profile_auto_delete);

        // Serialize subtitle URLs for storage
        let subtitle_urls_json = payload
            .subtitle_urls
            .as_ref()
            .filter(|v| !v.is_empty())
            .and_then(|v| serde_json::to_string(v).ok());

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
            subtitle_urls: subtitle_urls_json.clone(),
            subtitle_paths: None,
        };

        db.insert(&record).map_err(|e| e.to_string())?;
        drop(db); // Release before touching queue/active

        let item = QueueItem {
            id: id.clone(),
            profile_id: payload.profile_id.clone(),
            title: payload.title.clone(),
            stream_url: payload.stream_url.clone(),
            quality: payload.quality.clone(),
            smart_download,
            auto_delete,
            subtitle_urls_json,
        };

        self.queue
            .lock()
            .map_err(|_| "Queue lock poisoned".to_string())?
            .push_back(item);

        self.try_start_next(app);
        Ok(id)
    }

    fn try_start_next(&self, app: AppHandle) {
        dispatch_pending(
            app,
            Arc::clone(&self.db),
            Arc::clone(&self.queue),
            Arc::clone(&self.active),
            Arc::clone(&self.paused),
            self.max_concurrent,
        );
    }

    pub fn pause(&self, app: AppHandle, id: &str) -> Result<(), String> {
        self.paused
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?
            .push(id.to_string());
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .update_status(id, &DownloadStatus::Paused)
            .map_err(|e| e.to_string())?;
        emit_status(
            &app,
            StatusPayload {
                id: id.to_string(),
                status: "paused".into(),
                file_path: None,
                error: None,
            },
        );
        Ok(())
    }

    pub fn resume(&self, app: AppHandle, id: &str) -> Result<(), String> {
        self.paused
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?
            .retain(|p| p != id);

        let rec = self
            .db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_by_id(id)
            .map_err(|e| e.to_string())?
            .ok_or("Download not found")?;

        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
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
            subtitle_urls_json: rec.subtitle_urls.clone(),
        };
        self.queue
            .lock()
            .map_err(|_| "Queue lock poisoned".to_string())?
            .push_front(item);
        self.try_start_next(app);
        Ok(())
    }

    pub fn cancel(&self, app: AppHandle, id: &str) -> Result<(), String> {
        self.paused
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?
            .push(id.to_string()); // treat as paused so worker exits
        self.queue
            .lock()
            .map_err(|_| "Queue lock poisoned".to_string())?
            .retain(|q| q.id != id);
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .update_status(id, &DownloadStatus::Cancelled)
            .map_err(|e| e.to_string())?;
        emit_status(
            &app,
            StatusPayload {
                id: id.to_string(),
                status: "cancelled".into(),
                file_path: None,
                error: None,
            },
        );
        Ok(())
    }

    pub fn delete(&self, app: AppHandle, id: &str) -> Result<(), String> {
        let rec = self
            .db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_by_id(id)
            .map_err(|e| e.to_string())?;

        if let Some(rec) = rec {
            file_store::delete_files(&app, &rec.profile_id, id);
            file_store::delete_subtitle_files(rec.subtitle_paths.as_deref());
        }
        self.queue
            .lock()
            .map_err(|_| "Queue lock poisoned".to_string())?
            .retain(|q| q.id != id);
        self.paused
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?
            .retain(|p| p != id);
        self.active
            .lock()
            .map_err(|_| "Lock poisoned".to_string())?
            .retain(|a| a != id);
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .delete(id)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_downloads(&self, profile_id: &str) -> Result<Vec<DownloadRecord>, String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_all(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn get_storage_stats(&self, profile_id: &str) -> Result<(i64, i64), String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_storage_stats(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn get_quota(&self, profile_id: &str) -> Result<i64, String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_quota(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn set_quota(&self, profile_id: &str, quota_bytes: i64) -> Result<(), String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .set_quota(profile_id, quota_bytes)
            .map_err(|e| e.to_string())
    }

    pub fn get_smart_defaults(&self, profile_id: &str) -> Result<(bool, bool), String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .get_smart_defaults(profile_id)
            .map_err(|e| e.to_string())
    }

    pub fn set_smart_defaults(
        &self,
        profile_id: &str,
        smart: bool,
        auto_delete: bool,
    ) -> Result<(), String> {
        self.db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .set_smart_defaults(profile_id, smart, auto_delete)
            .map_err(|e| e.to_string())
    }

    pub fn delete_all_for_profile(&self, app: AppHandle, profile_id: &str) -> Result<(), String> {
        let ids = self
            .db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?
            .delete_all_for_profile(profile_id)
            .map_err(|e| e.to_string())?;
        for id in ids {
            file_store::delete_files(&app, profile_id, &id);
        }
        Ok(())
    }
}

// ─── Queue dispatcher ─────────────────────────────────────────────────────────

/// Starts queued downloads up to `max_concurrent`.
/// Safe to call from within async tasks — spawns new tasks and returns immediately.
fn dispatch_pending(
    app: AppHandle,
    db: Arc<Mutex<DownloadDb>>,
    queue: Arc<Mutex<VecDeque<QueueItem>>>,
    active: Arc<Mutex<Vec<String>>>,
    paused: Arc<Mutex<Vec<String>>>,
    max_concurrent: usize,
) {
    loop {
        let active_count = match active.lock() {
            Ok(a) => a.len(),
            Err(_) => return,
        };
        if active_count >= max_concurrent {
            return;
        }

        let item = match queue.lock() {
            Ok(mut q) => q.pop_front(),
            Err(_) => return,
        };
        let item = match item {
            Some(i) => i,
            None => return,
        };

        match active.lock() {
            Ok(mut a) => a.push(item.id.clone()),
            Err(_) => return,
        };

        let db2 = Arc::clone(&db);
        let queue2 = Arc::clone(&queue);
        let active2 = Arc::clone(&active);
        let paused2 = Arc::clone(&paused);
        let app2 = app.clone();
        let id = item.id.clone();
        let smart = item.smart_download;
        let auto_del = item.auto_delete;
        let subtitle_urls_json = item.subtitle_urls_json.clone();
        let profile_id = item.profile_id.clone();

        tauri::async_runtime::spawn(async move {
            let result = run_download(
                app2.clone(),
                db2.clone(),
                paused2.clone(),
                &item.id,
                &item.profile_id,
                &item.title,
                &item.stream_url,
                &item.quality,
            )
            .await;

            if let Ok(mut a) = active2.lock() {
                a.retain(|a| a != &id);
            }

            if result.is_ok() {
                // Download subtitles if provided and not already downloaded
                if let Some(urls_json) = subtitle_urls_json.as_deref() {
                    // Only download if subtitle_paths not yet set
                    let already_done = db2
                        .lock()
                        .ok()
                        .and_then(|d| d.get_by_id(&id).ok().flatten())
                        .and_then(|r| r.subtitle_paths)
                        .map(|p| !p.is_empty())
                        .unwrap_or(false);

                    if !already_done {
                        if let Some(paths_json) =
                            super::subtitles::download_subtitles(&app2, &profile_id, &id, urls_json)
                                .await
                        {
                            if let Ok(d) = db2.lock() {
                                d.update_subtitle_paths(&id, &paths_json).ok();
                            }
                        }
                    }
                }

                if smart {
                    smart_download_hook(app2.clone(), db2.clone(), &id, auto_del).await;
                }
            }

            // Continue draining the queue
            dispatch_pending(app2, db2, queue2, active2, paused2, max_concurrent);
        });
    }
}

// ─── Smart Downloads hook ─────────────────────────────────────────────────────

/// Post-completion hook for Smart Downloads.
/// Emits `download:queue_next` so the frontend can resolve the stream URL and
/// call download_start. The frontend is the only place that can resolve a
/// per-episode stream URL via the addon system.
async fn smart_download_hook(
    app: AppHandle,
    db: Arc<Mutex<DownloadDb>>,
    completed_id: &str,
    auto_delete: bool,
) {
    let next_ep = match db
        .lock()
        .ok()
        .and_then(|d| d.get_next_episode(completed_id).ok().flatten())
    {
        Some(ep) => ep,
        None => return,
    };

    // Optionally delete the completed file to free space before the next download
    if auto_delete {
        let profile_id = match db
            .lock()
            .ok()
            .and_then(|d| d.get_by_id(completed_id).ok().flatten())
        {
            Some(rec) => rec.profile_id,
            None => return,
        };
        file_store::delete_files(&app, &profile_id, completed_id);
        if let Ok(d) = db.lock() {
            d.delete(completed_id).ok();
        }
    }

    log::info!(
        "[SmartDownloads] Signalling next episode: {} S{}E{}",
        next_ep.title,
        next_ep.season.unwrap_or(0),
        next_ep.episode.unwrap_or(0),
    );

    emit_smart_next(
        &app,
        SmartNextPayload {
            profile_id: next_ep.profile_id,
            media_id: next_ep.media_id,
            media_type: next_ep.media_type,
            title: next_ep.title,
            poster_path: next_ep.poster_path,
            addon_id: next_ep.addon_id,
            quality: next_ep.quality.as_str().to_string(),
            season: next_ep.season.unwrap_or(0),
            episode: next_ep.episode.unwrap_or(0),
            smart_download: true,
            auto_delete: next_ep.auto_delete,
        },
    );
}

// ─── HLS detection ────────────────────────────────────────────────────────────

/// Returns true if the URL or its Content-Type indicates an HLS stream.
async fn is_hls_stream(client: &Client, url: &str) -> bool {
    let lower = url.to_lowercase();
    if lower.contains(".m3u8") || lower.contains("playlist.m3u") {
        return true;
    }
    // HEAD request fallback for HLS streams without .m3u8 in the URL
    match client
        .head(url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => {
            let ct = resp
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_lowercase();
            ct.contains("mpegurl")
        }
        Err(_) => false,
    }
}

// ─── Download worker ──────────────────────────────────────────────────────────

/// The async task that actually downloads a file.
/// Detects stream format and routes to the appropriate engine.
#[allow(clippy::too_many_arguments)]
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
    let client = Client::builder()
        .user_agent("Zentrio/1.0")
        .connect_timeout(std::time::Duration::from_secs(15))
        .read_timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    if is_hls_stream(&client, stream_url).await {
        return hls::download_hls(app, db, paused, id, profile_id, title, stream_url, quality)
            .await;
    }

    let part_path = file_store::part_file_path(&app, profile_id, id);
    let final_path = file_store::download_file_path(&app, profile_id, id);

    // Resume support: continue from where we left off
    let start_byte = if part_path.exists() {
        file_store::file_size(&part_path)
    } else {
        0
    };

    let mut req = client.get(stream_url);
    if start_byte > 0 {
        req = req.header("Range", format!("bytes={}-", start_byte));
    }

    let mut response = req.send().await.map_err(|e| {
        let msg = e.to_string();
        if let Ok(d) = db.lock() {
            d.update_error(id, &msg).ok();
        }
        emit_status(
            &app,
            StatusPayload {
                id: id.to_string(),
                status: "failed".into(),
                file_path: None,
                error: Some(msg.clone()),
            },
        );
        notifier::notify_failed(&app, title);
        msg
    })?;

    // If resume was requested but server ignored Range and returned 200,
    // restart from byte 0 to avoid appending duplicate bytes.
    let mut effective_start_byte = start_byte;
    if start_byte > 0 && response.status() == reqwest::StatusCode::OK {
        log::warn!(
            "[Downloads] Server ignored Range resume for {}. Restarting from byte 0.",
            id
        );
        effective_start_byte = 0;
        let _ = tokio::fs::remove_file(&part_path).await;
        response = client.get(stream_url).send().await.map_err(|e| {
            let msg = e.to_string();
            if let Ok(d) = db.lock() {
                d.update_error(id, &msg).ok();
            }
            emit_status(
                &app,
                StatusPayload {
                    id: id.to_string(),
                    status: "failed".into(),
                    file_path: None,
                    error: Some(msg.clone()),
                },
            );
            notifier::notify_failed(&app, title);
            msg
        })?;
    }

    if !response.status().is_success() {
        let msg = format!("Download request failed with HTTP {}", response.status());
        if let Ok(d) = db.lock() {
            d.update_error(id, &msg).ok();
        }
        emit_status(
            &app,
            StatusPayload {
                id: id.to_string(),
                status: "failed".into(),
                file_path: None,
                error: Some(msg.clone()),
            },
        );
        notifier::notify_failed(&app, title);
        return Err(msg);
    }

    let total_size = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<i64>().ok())
        .map(|s| s + effective_start_byte)
        .unwrap_or(0);

    let mut file_options = tokio::fs::OpenOptions::new();
    file_options.create(true).write(true);
    if effective_start_byte > 0 {
        file_options.append(true);
    } else {
        file_options.truncate(true);
    }
    let mut file = file_options
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut downloaded = effective_start_byte;
    let mut last_progress = -10.0_f64;
    let mut last_notif_progress: u8 = 0;
    let mut last_notif_time = Instant::now();
    let speed_window = Instant::now();
    let mut bytes_since_window: i64 = 0;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        // Pause / cancel check
        if paused
            .lock()
            .map(|p| p.contains(&id.to_string()))
            .unwrap_or(false)
        {
            file.flush().await.ok();
            return Ok(());
        }

        let chunk = chunk.map_err(|e| {
            let msg = e.to_string();
            if let Ok(d) = db.lock() {
                d.update_error(id, &msg).ok();
            }
            emit_status(
                &app,
                StatusPayload {
                    id: id.to_string(),
                    status: "failed".into(),
                    file_path: None,
                    error: Some(msg.clone()),
                },
            );
            notifier::notify_failed(&app, title);
            msg
        })?;

        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as i64;
        bytes_since_window += chunk.len() as i64;

        let progress = if total_size > 0 {
            (downloaded as f64 / total_size as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        // Emit progress ~every 1% to avoid flooding the UI
        if (progress - last_progress) >= 1.0 {
            last_progress = progress;
            if let Ok(d) = db.lock() {
                d.update_progress(id, progress, downloaded).ok();
            }

            let elapsed_secs = speed_window.elapsed().as_secs_f64().max(0.001);
            let speed = bytes_since_window as f64 / elapsed_secs;

            emit_progress(
                &app,
                ProgressPayload {
                    id: id.to_string(),
                    progress,
                    downloaded_bytes: downloaded,
                    speed,
                },
            );

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

    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| e.to_string())?;

    let size = file_store::file_size(&final_path);
    if let Ok(d) = db.lock() {
        d.update_complete(id, &final_path.to_string_lossy(), size)
            .ok();
    }

    emit_status(
        &app,
        StatusPayload {
            id: id.to_string(),
            status: "completed".into(),
            file_path: Some(final_path.to_string_lossy().to_string()),
            error: None,
        },
    );

    notifier::notify_complete(&app, title);

    Ok(())
}
