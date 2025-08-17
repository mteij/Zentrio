import { User } from "../../utils/db.ts";
import { addonSyncService } from "./addonSync.ts";
import cron from "node-cron";

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
      const userId = (user as { _id: { toString: () => string } })._id.toString();
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

let cronTask: cron.ScheduledTask | null = null;

export function startSyncScheduler() {
  if (cronTask) {
    console.log("[syncScheduler] Scheduler already running.");
    return;
  }

  // Schedule the task to run every 5 minutes
  cronTask = cron.schedule("*/5 * * * *", runSync, {
    scheduled: true,
  });

  console.log("[syncScheduler] Addon sync scheduler started.");
}

export function stopSyncScheduler() {
  if (cronTask) {
    console.log("[syncScheduler] Stopping addon sync scheduler.");
    cronTask.stop();
    cronTask = null;
  }
}