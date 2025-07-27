import { User } from "../../utils/db.ts";
import { addonSyncService } from "./addonSync.ts";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runSync() {
  console.log(`[syncScheduler] Starting scheduled addon sync run at ${new Date().toISOString()}`);
  try {
    const usersToSync = await User.find({
      "settings.addonSyncSettings.enabled": true,
      "settings.addonSyncSettings.autoSync": true,
    });

    if (usersToSync.length === 0) {
      console.log("[syncScheduler] No users with auto-sync enabled. Skipping sync run.");
      return;
    }

    console.log(`[syncScheduler] Found ${usersToSync.length} users to sync.`);

    for (const user of usersToSync) {
      const userId = (user as any)._id.toString();
      console.log(`[syncScheduler] Processing sync for user ${userId}`);
      try {
        const result = await addonSyncService.performSync(userId);
        console.log(`[syncScheduler] Completed sync for user ${userId} with result:`, result.message);
      } catch (error) {
        console.error(`[syncScheduler] Error during addon sync for user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error("[syncScheduler] Critical error fetching users for sync:", error);
  }
  console.log(`[syncScheduler] Finished scheduled addon sync run at ${new Date().toISOString()}`);
}

let intervalId: number | null = null;

export function startSyncScheduler() {
  if (intervalId) {
    console.log("[syncScheduler] Scheduler already running.");
    return;
  }

  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  // Calculate the delay until the next 5-minute mark
  const minutesUntilNextInterval = 5 - (minutes % 5);
  const secondsUntilNextInterval = (minutesUntilNextInterval * 60) - seconds;
  const delay = (secondsUntilNextInterval * 1000) - milliseconds;

  console.log(`[syncScheduler] Next sync scheduled in ${Math.round(delay / 1000)} seconds.`);

  // Schedule the first run
  setTimeout(() => {
    runSync();
    // After the first run, schedule subsequent runs every 5 minutes
    console.log(`[syncScheduler] Starting addon sync scheduler with a ${SYNC_INTERVAL_MS / 1000 / 60} minute interval.`);
    intervalId = setInterval(runSync, SYNC_INTERVAL_MS);
  }, delay);
}

export function stopSyncScheduler() {
  if (intervalId) {
    console.log("[syncScheduler] Stopping addon sync scheduler.");
    clearInterval(intervalId);
    intervalId = null;
  }
}