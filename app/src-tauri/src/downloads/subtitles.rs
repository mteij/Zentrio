use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::file_store;

/// A subtitle track entry, matching the frontend Stream.subtitles format.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleEntry {
    pub url: String,
    pub lang: String,
}

/// A locally-downloaded subtitle track with its file path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitlePathEntry {
    pub lang: String,
    pub path: String,
}

/// Downloads subtitle files for a completed download.
/// Returns a JSON string of `[{lang, path}, ...]` suitable for storing in the DB.
/// Silently skips any subtitle that fails to download.
pub async fn download_subtitles(
    app: &AppHandle,
    profile_id: &str,
    download_id: &str,
    subtitle_urls_json: &str,
) -> Option<String> {
    let entries: Vec<SubtitleEntry> = serde_json::from_str(subtitle_urls_json).ok()?;
    if entries.is_empty() {
        return None;
    }

    let client = Client::builder()
        .user_agent("Zentrio/1.0")
        .connect_timeout(std::time::Duration::from_secs(10))
        .read_timeout(std::time::Duration::from_secs(30))
        .build()
        .ok()?;

    let mut downloaded: Vec<SubtitlePathEntry> = Vec::new();

    for entry in &entries {
        let path = file_store::subtitle_file_path(app, profile_id, download_id, &entry.lang);

        // Skip if already downloaded (resume scenario)
        if path.exists() {
            downloaded.push(SubtitlePathEntry {
                lang: entry.lang.clone(),
                path: path.to_string_lossy().to_string(),
            });
            continue;
        }

        match client.get(&entry.url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(bytes) = resp.bytes().await {
                    if tokio::fs::write(&path, &bytes).await.is_ok() {
                        downloaded.push(SubtitlePathEntry {
                            lang: entry.lang.clone(),
                            path: path.to_string_lossy().to_string(),
                        });
                    } else {
                        log::warn!(
                            "[Subtitles] Failed to write subtitle file for lang={}",
                            entry.lang
                        );
                    }
                }
            }
            Ok(resp) => {
                log::warn!(
                    "[Subtitles] HTTP {} for subtitle lang={}",
                    resp.status(),
                    entry.lang
                );
            }
            Err(e) => {
                log::warn!(
                    "[Subtitles] Failed to download subtitle lang={}: {}",
                    entry.lang,
                    e
                );
            }
        }
    }

    if downloaded.is_empty() {
        return None;
    }

    serde_json::to_string(&downloaded).ok()
}
