# Sync Implementation Plan

This plan details the steps to implement the synchronization feature for Zentrio.

## Phase 1: Database Schema Updates

1.  **Create `sync_state` table**:
    *   Stores remote URL, auth token, last sync timestamp.
2.  **Modify Entity Tables**:
    *   Add `remote_id` (TEXT), `dirty` (BOOLEAN), `deleted_at` (DATETIME) to:
        *   `profiles`
        *   `settings_profiles`
        *   `profile_addons`
        *   `stream_settings`
        *   `appearance_settings`
        *   `watch_history`
        *   `lists`
        *   `list_items`
3.  **Update Database Service**:
    *   Update `app/src/services/database.ts` to include these migrations.
    *   Update CRUD operations to set `dirty = TRUE` on changes.
    *   Update delete operations to perform soft deletes (set `deleted_at` and `dirty = TRUE`) instead of hard deletes.

## Phase 2: Sync Service Implementation

1.  **Create `SyncService` class**:
    *   Located in `app/src/services/sync.ts`.
    *   Methods: `push()`, `pull()`, `sync()`.
2.  **Implement Push Logic**:
    *   Query dirty records.
    *   Format payload for remote API.
    *   Handle response and update `remote_id` / `dirty` flags.
3.  **Implement Pull Logic**:
    *   Fetch changes from remote API.
    *   Apply changes to local DB (insert/update/delete).
    *   Update `last_sync_at`.
4.  **Background Job**:
    *   Set up a periodic interval (e.g., every 5 minutes) to run `sync()`.
    *   Trigger sync on app resume/online events.

## Phase 3: UI Integration

1.  **Settings Page**:
    *   Add "Cloud Sync" section.
    *   Form to enter Remote URL (default `https://zentrio.eu`) and Login credentials.
    *   "Sync Now" button.
    *   Status indicator (Last synced at..., Syncing..., Error).
2.  **Auth Integration**:
    *   When logging in to remote, store the token in `sync_state`.

## Phase 4: Remote API (Server-Side)

*Note: This assumes we have control over the server code or are updating the self-hosted version.*

1.  **Create Sync Endpoints**:
    *   `POST /api/sync/push`
    *   `GET /api/sync/pull`
2.  **Authentication**:
    *   Ensure endpoints are protected by the existing auth mechanism.

## Phase 5: Testing

1.  **Unit Tests**: Test conflict resolution logic.
2.  **Integration Tests**: Test full sync cycle with a mock server.
3.  **Manual Testing**: Verify data propagates between two local instances connected to the same remote.
