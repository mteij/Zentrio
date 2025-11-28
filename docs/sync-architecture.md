# Synchronization Architecture

This document outlines the architecture for synchronizing data between the local Zentrio app (Tauri) and a remote Zentrio instance (e.g., zentrio.eu).

## Overview

The goal is to allow users to "connect" their local app to a remote account. This enables:
1.  **Backup**: Local data is safely stored on the server.
2.  **Multi-device Sync**: Changes made on one device (e.g., desktop) propagate to others (e.g., mobile, web).
3.  **Offline Support**: The app works fully offline using the local database and syncs when online.

## Data Model Changes

To support synchronization, we need to track the sync state of each record.

### 1. `sync_state` Table
Tracks the global sync status and last sync timestamps.

```sql
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton
  remote_url TEXT,
  remote_user_id TEXT,
  auth_token TEXT,
  last_sync_at DATETIME,
  is_syncing BOOLEAN DEFAULT FALSE
);
```

### 2. Entity Tables (Profiles, Addons, History, etc.)
Each synchronizable table needs columns to track remote state.

*   `remote_id` (TEXT, nullable): The ID of the corresponding record on the server.
*   `updated_at` (DATETIME): Already exists, crucial for conflict resolution.
*   `deleted_at` (DATETIME, nullable): For soft deletes (tombstones) to propagate deletions.
*   `dirty` (BOOLEAN): Marks records changed locally that need to be pushed.

**Synchronizable Entities:**
*   `profiles`
*   `settings_profiles`
*   `profile_addons`
*   `stream_settings`
*   `appearance_settings`
*   `watch_history`
*   `lists`
*   `list_items`

## Synchronization Protocol

We will use a "Push-Pull" strategy with "Last Write Wins" (LWW) conflict resolution based on timestamps.

### 1. Authentication
*   User enters remote URL (default: `https://zentrio.eu`) and credentials.
*   App authenticates and stores the `auth_token` in `sync_state`.

### 2. Sync Process (Periodic & Event-driven)

**Step A: Push (Local -> Remote)**
1.  Find all local records where `dirty = TRUE`.
2.  Send batch update to remote API endpoint `POST /api/sync/push`.
3.  Remote server processes updates:
    *   If `remote_id` is null, create new record.
    *   If `remote_id` exists, update if `local.updated_at > remote.updated_at`.
4.  Remote returns success with assigned `remote_id`s for new records.
5.  Local updates `remote_id`s and sets `dirty = FALSE`.

**Step B: Pull (Remote -> Local)**
1.  Request changes from remote API `GET /api/sync/pull?since={last_sync_at}`.
2.  Remote returns all records modified after `last_sync_at`.
3.  Local processes updates:
    *   If record doesn't exist locally, create it.
    *   If record exists, update if `remote.updated_at > local.updated_at`.
    *   If `deleted_at` is set, delete locally.
4.  Update `last_sync_at` in `sync_state`.

## API Endpoints (Remote Side)

*   `POST /api/sync/push`: Accepts a JSON payload of changes.
*   `GET /api/sync/pull`: Returns a JSON payload of changes since a timestamp.

## Conflict Resolution
*   **Last Write Wins**: The record with the most recent `updated_at` timestamp wins.
*   **Clocks**: We assume reasonably synchronized clocks, but server time is the authority for `last_sync_at`.

## Implementation Plan

1.  **Database Migration**: Add `sync_state` table and modify existing tables (`remote_id`, `dirty`, `deleted_at`).
2.  **Sync Service**: Create a background service in the app to handle the Push/Pull logic.
3.  **UI**: Add "Connect to Cloud" in Settings to input credentials and view sync status.
4.  **Remote API**: Implement the sync endpoints on the server (this requires server-side changes if not already present).
