use std::sync::{Arc, Mutex};
use std::time::Instant;

use m3u8_rs::{MasterPlaylist, MediaPlaylist, Playlist};
use reqwest::Client;
use tauri::AppHandle;
use tokio::io::AsyncWriteExt;

use super::db::DownloadDb;
use super::events::{emit_progress, emit_status, ProgressPayload, StatusPayload};
use super::file_store;
use super::notifier;

/// Download an HLS stream given its master or media playlist URL.
/// Outputs a concatenated MP4-compatible file at `final_path`.
pub async fn download_hls(
    app: AppHandle,
    db: Arc<Mutex<DownloadDb>>,
    paused: Arc<Mutex<Vec<String>>>,
    id: &str,
    profile_id: &str,
    title: &str,
    playlist_url: &str,
    quality_pref: &str, // "standard" | "higher" | "best"
) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("Zentrio/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    // ── 1. Fetch the playlist ──────────────────────────────────────────────────
    let playlist_bytes = client
        .get(playlist_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch playlist: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read playlist body: {e}"))?;

    let segment_urls = match m3u8_rs::parse_playlist_res(&playlist_bytes) {
        Ok(Playlist::MasterPlaylist(master)) => {
            // Pick the best variant stream based on quality preference
            let variant_url = pick_variant(&master, playlist_url, quality_pref)?;
            fetch_media_segments(&client, &variant_url).await?
        }
        Ok(Playlist::MediaPlaylist(media)) => {
            // Already a media playlist — resolve relative URIs against the base URL
            resolve_segments(&media, playlist_url)
        }
        Err(e) => {
            return Err(format!("Failed to parse HLS playlist: {e:?}"));
        }
    };

    if segment_urls.is_empty() {
        return Err("HLS playlist contained no segments".into());
    }

    // ── 2. Download all segments sequentially ─────────────────────────────────
    let final_path = file_store::download_file_path(&app, profile_id, id);
    let part_path = file_store::part_file_path(&app, profile_id, id);

    let mut output = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    let total = segment_urls.len();
    let mut done = 0usize;
    let mut last_progress = -5.0_f64;
    let mut last_notif_pct: u8 = 0;
    let mut last_notif_time = Instant::now();
    let speed_start = Instant::now();
    let mut bytes_total: i64 = 0;

    for url in &segment_urls {
        // Pause / cancel check
        if paused.lock().unwrap().contains(&id.to_string()) {
            output.flush().await.ok();
            db.lock().unwrap()
                .update_status(id, &super::db::DownloadStatus::Paused)
                .ok();
            emit_status(&app, StatusPayload {
                id: id.to_string(),
                status: "paused".into(),
                file_path: None,
                error: None,
            });
            return Ok(());
        }

        let seg_bytes = download_segment(&client, url).await.map_err(|e| {
            let msg = format!("Segment fetch failed: {e}");
            db.lock().unwrap().update_error(id, &msg).ok();
            emit_status(&app, StatusPayload {
                id: id.to_string(),
                status: "failed".into(),
                file_path: None,
                error: Some(msg.clone()),
            });
            notifier::notify_failed(&app, title);
            msg
        })?;

        bytes_total += seg_bytes.len() as i64;
        output
            .write_all(&seg_bytes)
            .await
            .map_err(|e| e.to_string())?;

        done += 1;
        let progress = done as f64 / total as f64 * 100.0;

        if (progress - last_progress) >= 1.0 {
            last_progress = progress;
            db.lock()
                .unwrap()
                .update_progress(id, progress, bytes_total)
                .ok();

            let speed = bytes_total as f64 / speed_start.elapsed().as_secs_f64().max(0.001);
            emit_progress(
                &app,
                ProgressPayload {
                    id: id.to_string(),
                    progress,
                    downloaded_bytes: bytes_total,
                    speed,
                },
            );

            let pct = progress as u8;
            if pct / 10 > last_notif_pct / 10 || last_notif_time.elapsed().as_secs() >= 30 {
                last_notif_pct = pct;
                last_notif_time = Instant::now();
                notifier::notify_progress(&app, id, title, pct, speed / 1024.0);
            }
        }
    }

    output.flush().await.map_err(|e| e.to_string())?;
    drop(output);

    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| e.to_string())?;

    let size = file_store::file_size(&final_path);
    db.lock()
        .unwrap()
        .update_complete(id, &final_path.to_string_lossy(), size)
        .ok();

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn pick_variant(
    master: &MasterPlaylist,
    base_url: &str,
    quality_pref: &str,
) -> Result<String, String> {
    if master.variants.is_empty() {
        return Err("Master playlist has no variants".into());
    }

    // Sort by bandwidth descending
    let mut variants: Vec<_> = master.variants.iter().collect();
    variants.sort_by_key(|v| std::cmp::Reverse(v.bandwidth));

    // Map quality preference to a maximum bandwidth cap (rough heuristic)
    let selected = match quality_pref {
        "standard" => {
            // Pick the lowest quality that is ≥ 720p or the first available
            variants.iter().rev()
                .find(|v| v.bandwidth >= 1_000_000)
                .or_else(|| variants.last())
        }
        "higher" => {
            // Pick the best quality ≤ 8 Mbps (≈1080p)
            variants.iter()
                .find(|v| v.bandwidth <= 8_000_000)
                .or_else(|| variants.first())
        }
        _ => {
            // "best" — pick the highest bandwidth
            variants.first()
        }
    };

    let variant = selected.ok_or("No suitable variant found")?;
    let uri = &variant.uri;

    // Resolve relative URI
    if uri.starts_with("http") {
        Ok(uri.clone())
    } else {
        let base = base_url.rfind('/').map(|i| &base_url[..=i]).unwrap_or(base_url);
        Ok(format!("{}{}", base, uri))
    }
}

async fn fetch_media_segments(client: &Client, media_url: &str) -> Result<Vec<String>, String> {
    let bytes = client
        .get(media_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    match m3u8_rs::parse_playlist_res(&bytes) {
        Ok(Playlist::MediaPlaylist(media)) => Ok(resolve_segments(&media, media_url)),
        Ok(Playlist::MasterPlaylist(_)) => Err("Unexpected nested master playlist".into()),
        Err(e) => Err(format!("Failed to parse media playlist: {e:?}")),
    }
}

fn resolve_segments(media: &MediaPlaylist, base_url: &str) -> Vec<String> {
    let base = base_url.rfind('/').map(|i| &base_url[..=i]).unwrap_or(base_url);
    media
        .segments
        .iter()
        .map(|seg| {
            if seg.uri.starts_with("http") {
                seg.uri.clone()
            } else {
                format!("{}{}", base, seg.uri)
            }
        })
        .collect()
}

async fn download_segment(client: &Client, url: &str) -> Result<Vec<u8>, String> {
    let mut attempts = 0u8;
    loop {
        match client.get(url).send().await {
            Ok(resp) => {
                return resp.bytes().await
                    .map(|b| b.to_vec())
                    .map_err(|e| e.to_string());
            }
            Err(e) if attempts < 3 => {
                attempts += 1;
                tokio::time::sleep(std::time::Duration::from_millis(500 * attempts as u64)).await;
                eprintln!("[HLS] Retrying segment ({attempts}/3): {url} — {e}");
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}
