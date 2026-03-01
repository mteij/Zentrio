use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl DownloadStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Downloading => "downloading",
            Self::Paused => "paused",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
    pub fn from_str(s: &str) -> Self {
        match s {
            "queued" => Self::Queued,
            "downloading" => Self::Downloading,
            "paused" => Self::Paused,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            _ => Self::Cancelled,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadQuality {
    Standard,
    Higher,
    Best,
}

impl DownloadQuality {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Higher => "higher",
            Self::Best => "best",
        }
    }
    pub fn from_str(s: &str) -> Self {
        match s {
            "higher" => Self::Higher,
            "best" => Self::Best,
            _ => Self::Standard,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRecord {
    pub id: String,
    pub profile_id: String,
    pub media_type: String,
    pub media_id: String,
    pub episode_id: Option<String>,
    pub title: String,
    pub episode_title: Option<String>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub poster_path: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub quality: DownloadQuality,
    pub file_path: String,
    pub file_size: i64,
    pub downloaded_bytes: i64,
    pub added_at: i64,
    pub completed_at: Option<i64>,
    pub last_watched_at: Option<i64>,
    pub watched_percent: f64,
    pub stream_url: String,
    pub addon_id: String,
    pub error_message: Option<String>,
    /// Smart Downloads: auto-queue the next episode when this one completes
    pub smart_download: bool,
    /// Smart Downloads: delete this file after watching
    pub auto_delete: bool,
}

pub struct DownloadDb {
    conn: Connection,
}

impl DownloadDb {
    pub fn open(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                media_type TEXT NOT NULL,
                media_id TEXT NOT NULL,
                episode_id TEXT,
                title TEXT NOT NULL,
                episode_title TEXT,
                season INTEGER,
                episode INTEGER,
                poster_path TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL NOT NULL DEFAULT 0,
                quality TEXT NOT NULL DEFAULT 'standard',
                file_path TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                downloaded_bytes INTEGER NOT NULL DEFAULT 0,
                added_at INTEGER NOT NULL,
                completed_at INTEGER,
                last_watched_at INTEGER,
                watched_percent REAL NOT NULL DEFAULT 0,
                stream_url TEXT NOT NULL,
                addon_id TEXT NOT NULL DEFAULT '',
                error_message TEXT,
                smart_download INTEGER NOT NULL DEFAULT 0,
                auto_delete INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_downloads_profile ON downloads(profile_id);
            CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

            -- Profile-level settings (quota, smart download defaults)
            CREATE TABLE IF NOT EXISTS profile_settings (
                profile_id TEXT PRIMARY KEY,
                quota_bytes INTEGER NOT NULL DEFAULT 0,
                smart_download_default INTEGER NOT NULL DEFAULT 0,
                auto_delete_default INTEGER NOT NULL DEFAULT 0
            );
        ")?;

        // Idempotent schema migrations for existing databases
        let _ = self.conn.execute("ALTER TABLE downloads ADD COLUMN smart_download INTEGER NOT NULL DEFAULT 0", []);
        let _ = self.conn.execute("ALTER TABLE downloads ADD COLUMN auto_delete INTEGER NOT NULL DEFAULT 0", []);

        Ok(())
    }

    pub fn insert(&self, rec: &DownloadRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO downloads (id, profile_id, media_type, media_id, episode_id, title, episode_title,
             season, episode, poster_path, status, progress, quality, file_path, file_size, downloaded_bytes,
             added_at, completed_at, last_watched_at, watched_percent, stream_url, addon_id, error_message,
             smart_download, auto_delete)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
            params![
                rec.id, rec.profile_id, rec.media_type, rec.media_id, rec.episode_id,
                rec.title, rec.episode_title, rec.season, rec.episode, rec.poster_path,
                rec.status.as_str(), rec.progress, rec.quality.as_str(), rec.file_path,
                rec.file_size, rec.downloaded_bytes, rec.added_at, rec.completed_at,
                rec.last_watched_at, rec.watched_percent, rec.stream_url, rec.addon_id,
                rec.error_message, rec.smart_download as i64, rec.auto_delete as i64
            ],
        )?;
        Ok(())
    }

    pub fn get_all(&self, profile_id: &str) -> Result<Vec<DownloadRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, media_type, media_id, episode_id, title, episode_title,
             season, episode, poster_path, status, progress, quality, file_path, file_size,
             downloaded_bytes, added_at, completed_at, last_watched_at, watched_percent,
             stream_url, addon_id, error_message, smart_download, auto_delete
             FROM downloads WHERE profile_id = ?1 ORDER BY added_at DESC"
        )?;
        let rows = stmt.query_map([profile_id], |row| {
            Ok(DownloadRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                media_type: row.get(2)?,
                media_id: row.get(3)?,
                episode_id: row.get(4)?,
                title: row.get(5)?,
                episode_title: row.get(6)?,
                season: row.get(7)?,
                episode: row.get(8)?,
                poster_path: row.get(9)?,
                status: DownloadStatus::from_str(&row.get::<_, String>(10)?),
                progress: row.get(11)?,
                quality: DownloadQuality::from_str(&row.get::<_, String>(12)?),
                file_path: row.get(13)?,
                file_size: row.get(14)?,
                downloaded_bytes: row.get(15)?,
                added_at: row.get(16)?,
                completed_at: row.get(17)?,
                last_watched_at: row.get(18)?,
                watched_percent: row.get(19)?,
                stream_url: row.get(20)?,
                addon_id: row.get(21)?,
                error_message: row.get(22)?,
                smart_download: row.get::<_, i64>(23)? != 0,
                auto_delete: row.get::<_, i64>(24)? != 0,
            })
        })?;
        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }
        Ok(records)
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<DownloadRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, media_type, media_id, episode_id, title, episode_title,
             season, episode, poster_path, status, progress, quality, file_path, file_size,
             downloaded_bytes, added_at, completed_at, last_watched_at, watched_percent,
             stream_url, addon_id, error_message, smart_download, auto_delete
             FROM downloads WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map([id], |row| {
            Ok(DownloadRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                media_type: row.get(2)?,
                media_id: row.get(3)?,
                episode_id: row.get(4)?,
                title: row.get(5)?,
                episode_title: row.get(6)?,
                season: row.get(7)?,
                episode: row.get(8)?,
                poster_path: row.get(9)?,
                status: DownloadStatus::from_str(&row.get::<_, String>(10)?),
                progress: row.get(11)?,
                quality: DownloadQuality::from_str(&row.get::<_, String>(12)?),
                file_path: row.get(13)?,
                file_size: row.get(14)?,
                downloaded_bytes: row.get(15)?,
                added_at: row.get(16)?,
                completed_at: row.get(17)?,
                last_watched_at: row.get(18)?,
                watched_percent: row.get(19)?,
                stream_url: row.get(20)?,
                addon_id: row.get(21)?,
                error_message: row.get(22)?,
                smart_download: row.get::<_, i64>(23)? != 0,
                auto_delete: row.get::<_, i64>(24)? != 0,
            })
        })?;
        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn update_progress(&self, id: &str, progress: f64, downloaded_bytes: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE downloads SET progress = ?1, downloaded_bytes = ?2, status = 'downloading' WHERE id = ?3",
            params![progress, downloaded_bytes, id],
        )?;
        Ok(())
    }

    pub fn update_status(&self, id: &str, status: &DownloadStatus) -> Result<()> {
        self.conn.execute(
            "UPDATE downloads SET status = ?1 WHERE id = ?2",
            params![status.as_str(), id],
        )?;
        Ok(())
    }

    pub fn update_complete(&self, id: &str, file_path: &str, file_size: i64) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.conn.execute(
            "UPDATE downloads SET status = 'completed', progress = 100, file_path = ?1, file_size = ?2, completed_at = ?3 WHERE id = ?4",
            params![file_path, file_size, now, id],
        )?;
        Ok(())
    }

    pub fn update_error(&self, id: &str, error: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE downloads SET status = 'failed', error_message = ?1 WHERE id = ?2",
            params![error, id],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM downloads WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn get_storage_stats(&self, profile_id: &str) -> Result<(i64, i64)> {
        // Returns (total_size_bytes, count) for completed downloads
        let mut stmt = self.conn.prepare(
            "SELECT COALESCE(SUM(file_size),0), COUNT(*) FROM downloads WHERE profile_id=?1 AND status='completed'"
        )?;
        let (size, count) = stmt.query_row([profile_id], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))
        })?;
        Ok((size, count))
    }

    pub fn delete_all_for_profile(&self, profile_id: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT id FROM downloads WHERE profile_id=?1")?;
        let ids: Vec<String> = stmt.query_map([profile_id], |r| r.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        self.conn.execute("DELETE FROM downloads WHERE profile_id=?1", [profile_id])?;
        Ok(ids)
    }

    /// Returns the next episode to auto-download after `completed_id` finishes.
    /// Looks for the next episode number in the same series/season.
    pub fn get_next_episode(&self, completed_id: &str) -> Result<Option<DownloadRecord>> {
        // First find the completed record
        let rec = match self.get_by_id(completed_id)? {
            Some(r) => r,
            None => return Ok(None),
        };

        if rec.media_type != "series" {
            return Ok(None); // Only series have episodes to chain
        }
        let (season, episode) = match (rec.season, rec.episode) {
            (Some(s), Some(e)) => (s, e),
            _ => return Ok(None),
        };

        // Find a completed download one episode later (same season or next)
        // We just return metadata to allow the manager to enqueue — we don't have the stream URL yet,
        // so we clone the completed record with incremented episode number and the same stream_url.
        // The manager will attempt to download the next segment of the playlist.
        let next_ep = episode + 1;

        // Check there isn't already a download for this episode
        let existing: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM downloads WHERE profile_id=?1 AND media_id=?2 AND season=?3 AND episode=?4 AND status != 'cancelled'",
            params![rec.profile_id, rec.media_id, season, next_ep],
            |r| r.get(0),
        ).unwrap_or(0);

        if existing > 0 {
            return Ok(None); // Already downloading or downloaded
        }

        // Build a template record for the next episode
        let next = DownloadRecord {
            id: String::new(), // Will be assigned by manager
            profile_id: rec.profile_id.clone(),
            media_type: rec.media_type.clone(),
            media_id: rec.media_id.clone(),
            episode_id: None,
            title: rec.title.clone(),
            episode_title: Some(format!("S{}:E{}", season, next_ep)),
            season: Some(season),
            episode: Some(next_ep),
            poster_path: rec.poster_path.clone(),
            status: DownloadStatus::Queued,
            progress: 0.0,
            quality: rec.quality.clone(),
            file_path: String::new(),
            file_size: 0,
            downloaded_bytes: 0,
            added_at: 0,
            completed_at: None,
            last_watched_at: None,
            watched_percent: 0.0,
            stream_url: rec.stream_url.clone(), // Reuse same stream URL for HLS playlists
            addon_id: rec.addon_id.clone(),
            error_message: None,
            smart_download: true,
            auto_delete: rec.auto_delete,
        };

        Ok(Some(next))
    }

    // ── Profile-level quota and smart download defaults ────────────────────────

    pub fn get_quota(&self, profile_id: &str) -> Result<i64> {
        let result = self.conn.query_row(
            "SELECT quota_bytes FROM profile_settings WHERE profile_id=?1",
            [profile_id],
            |r| r.get(0),
        );
        Ok(result.unwrap_or(0))
    }

    pub fn set_quota(&self, profile_id: &str, quota_bytes: i64) -> Result<()> {
        self.conn.execute(
            "INSERT INTO profile_settings (profile_id, quota_bytes) VALUES (?1, ?2)
             ON CONFLICT(profile_id) DO UPDATE SET quota_bytes=excluded.quota_bytes",
            params![profile_id, quota_bytes],
        )?;
        Ok(())
    }

    pub fn get_smart_defaults(&self, profile_id: &str) -> Result<(bool, bool)> {
        let result = self.conn.query_row(
            "SELECT smart_download_default, auto_delete_default FROM profile_settings WHERE profile_id=?1",
            [profile_id],
            |r| Ok((r.get::<_, i64>(0)? != 0, r.get::<_, i64>(1)? != 0)),
        );
        Ok(result.unwrap_or((false, false)))
    }

    pub fn set_smart_defaults(&self, profile_id: &str, smart: bool, auto_delete: bool) -> Result<()> {
        self.conn.execute(
            "INSERT INTO profile_settings (profile_id, smart_download_default, auto_delete_default) VALUES (?1, ?2, ?3)
             ON CONFLICT(profile_id) DO UPDATE SET smart_download_default=excluded.smart_download_default, auto_delete_default=excluded.auto_delete_default",
            params![profile_id, smart as i64, auto_delete as i64],
        )?;
        Ok(())
    }

    pub fn update_smart_flags(&self, id: &str, smart: bool, auto_delete: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE downloads SET smart_download=?1, auto_delete=?2 WHERE id=?3",
            params![smart as i64, auto_delete as i64, id],
        )?;
        Ok(())
    }
}
