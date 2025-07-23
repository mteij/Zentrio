/**
 * Addon Sync Service
 * Syncs addons between profiles using the Stremio API client
 */

// --- FIX: Use StremioAPIStore for login and addon sync, not the stateless APIClient ---
import { StremioAPIStore } from "stremio-api-client";
import { Profile, User, getDecryptedProfilePassword } from '../../utils/db.ts';

interface SyncResult {
  success: boolean;
  syncedProfiles: number;
  errors: string[];
  message: string;
}

interface AddonData {
  transportUrl: string;
  manifest: {
    id: string;
    name: string;
    version: string;
    description?: string;
    logo?: string;
  };
  flags?: {
    official?: boolean;
    protected?: boolean;
  };
}

class AddonSyncService {
  // Remove the client cache, as the API is stateless

  // Use StremioAPIStore for login and addon management
  private async getStremioStore(profile: any): Promise<StremioAPIStore> {
    try {
      // Passwords are encrypted in the DB, so we must always use getDecryptedProfilePassword
      const password = await getDecryptedProfilePassword(profile);
      console.debug(`[addonSync] Logging in profile ${profile.email}...`);
      console.debug(`[addonSync] Credentials: email=${profile.email}, password.length=${password?.length}`);
      if (!password || password.length < 4) {
        console.error(`[addonSync] Decrypted password for ${profile.email} is empty or too short!`);
      }
      const store = new StremioAPIStore();
      console.debug(`[addonSync] StremioAPIStore endpoint:`, (store as any).endpoint);

      // Extra debug: check if password is empty or suspicious
      if (!password || password.length < 4) {
        console.error(`[addonSync] Password for ${profile.email} is empty or too short!`);
      }
      // Extra debug: check if email looks valid
      if (!profile.email || !profile.email.includes("@")) {
        console.error(`[addonSync] Email for profile is invalid:`, profile.email);
      }

      let loginResult;
      try {
        loginResult = await store.login({
          email: profile.email,
          password: password,
        });
      } catch (err) {
        console.error(`[addonSync] store.login() threw for ${profile.email}:`, err);
        if (err && typeof err === "object" && "message" in err) {
          if ((err as any).message?.toLowerCase().includes("invalid password")) {
            console.error(`[addonSync] Stremio API says: Invalid password for ${profile.email}`);
          }
          if ((err as any).message?.toLowerCase().includes("user not found")) {
            console.error(`[addonSync] Stremio API says: User not found for ${profile.email}`);
          }
        }
        throw new Error(`store.login() threw: ${err instanceof Error ? err.message : String(err)}`);
      }
      console.debug(`[addonSync] store.login() result for ${profile.email}:`, loginResult);
      console.debug(`[addonSync] store.user after login for ${profile.email}:`, store.user);

      // Try to pull user to see if API is reachable
      if (store.user && store.user._id) {
        try {
          await store.pullUser();
          console.debug(`[addonSync] Successfully pulled user for ${profile.email}`);
        } catch (pullErr) {
          console.error(`[addonSync] pullUser() failed for ${profile.email}:`, pullErr);
        }
      }

      // Extra debug: log the raw password (for local debugging only, remove in production!)
      // console.debug(`[addonSync] RAW PASSWORD for ${profile.email}:`, password);

      // If authKey is missing, try to fetch it manually from store.user or loginResult
      if (!store.user || !store.user.authKey) {
        console.error(`[addonSync] store.user.authKey is missing after login for ${profile.email}. store.user:`, store.user);
        if (loginResult && loginResult.authKey) {
          console.warn(`[addonSync] loginResult.authKey exists but not set on store.user. Forcing it.`);
          store.user.authKey = loginResult.authKey;
        }
      }

      // Final check
      if (!store.user || !store.user.authKey) {
        // Print out the full user object and store for inspection
        console.error(`[addonSync] Login failed for ${profile.email}: store.user=`, store.user, "store=", store);
        // Suggest next debugging steps
        console.error(`[addonSync] Possible causes:`);
        console.error(`- Wrong email or password (try logging in manually at https://web.stremio.com/)`);
        console.error(`- Stremio API is down or unreachable from your server`);
        console.error(`- Account is locked, banned, or requires email verification`);
        console.error(`- StremioAPIStore or stremio-api-client version mismatch`);
        throw new Error("Login failed: No authKey returned. Possible reasons: wrong credentials, Stremio API unreachable, or account locked. (Password was decrypted before use)");
      }
      return store;
    } catch (error) {
      // Log the full error stack for deep debugging
      if (error instanceof Error && error.stack) {
        console.error(`[addonSync] Full error stack for ${profile.email}:`, error.stack);
      }
      console.error(`[addonSync] Failed to login for profile ${profile.email}:`, error);
      throw new Error(`Failed to login for profile ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getProfileAddons(profile: any): Promise<AddonData[]> {
    try {
      const store = await this.getStremioStore(profile);
      console.debug(`[addonSync] Pulling addons for profile ${profile.email}...`);
      await store.pullAddonCollection();
      const addons = store.addons || [];
      console.debug(`[addonSync] Pulled addons for ${profile.email}:`, addons);
      return addons.map((addon: any) => ({
        transportUrl: addon.transportUrl,
        manifest: {
          id: addon.manifest.id,
          name: addon.manifest.name,
          version: addon.manifest.version,
          description: addon.manifest.description,
          logo: addon.manifest.logo,
        },
        flags: addon.flags,
      }));
    } catch (error) {
      console.error(`[addonSync] Failed to get addons for profile ${profile.email}:`, error);
      throw new Error(`Failed to get addons for profile ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setProfileAddons(profile: any, addons: AddonData[]): Promise<void> {
    try {
      const store = await this.getStremioStore(profile);
      console.debug(`[addonSync] Setting addons for profile ${profile.email}...`, addons);
      await store.pushAddonCollection(addons);
      // Optionally, verify by pulling again or checking store.addons
      console.debug(`[addonSync] Set addons for ${profile.email}`);
    } catch (error) {
      console.error(`[addonSync] Failed to set addons for profile ${profile.email}:`, error);
      throw new Error(`Failed to set addons for profile ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async syncMainToAll(userId: string): Promise<SyncResult> {
    console.debug(`[addonSync] Starting syncMainToAll for user ${userId}`);
    const errors: string[] = [];
    let syncedProfiles = 0;

    try {
      const user = await User.findById(userId);
      console.debug(`[addonSync] Loaded user:`, user);
      if (!user || !user.addonSyncSettings?.enabled) {
        return {
          success: false,
          syncedProfiles: 0,
          errors: [],
          message: 'Addon sync is not enabled for this user'
        };
      }

      const { mainProfileId } = user.addonSyncSettings;
      if (!mainProfileId) {
        return {
          success: false,
          syncedProfiles: 0,
          errors: [],
          message: 'No main profile selected for sync'
        };
      }

      const profiles = await Profile.find({ userId });
      console.debug(`[addonSync] Loaded profiles:`, profiles.map((p: any) => ({ id: p._id, email: p.email })));
      const mainProfile = profiles.find((p: any) => p._id.toString() === mainProfileId.toString());

      if (!mainProfile) {
        return {
          success: false,
          syncedProfiles: 0,
          errors: [],
          message: 'Main profile not found'
        };
      }

      let mainAddons: AddonData[];
      try {
        mainAddons = await this.getProfileAddons(mainProfile);
        console.debug(`[addonSync] Main profile addons:`, mainAddons);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        return {
          success: false,
          syncedProfiles: 0,
          errors,
          message: 'Failed to get addons from main profile'
        };
      }

      if (!mainAddons || mainAddons.length === 0) {
        return {
          success: true,
          syncedProfiles: 0,
          errors: [],
          message: 'Main profile has no addons to sync'
        };
      }

      const otherProfiles = profiles.filter((p: any) => p._id.toString() !== mainProfileId.toString());

      for (const profile of otherProfiles) {
        try {
          await this.setProfileAddons(profile, mainAddons);
          syncedProfiles++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${profile.name}: ${message}`);
        }
      }

      await User.findByIdAndUpdate(userId, {
        'addonSyncSettings.lastSyncAt': new Date()
      });

      console.debug(`[addonSync] Sync complete. Synced profiles: ${syncedProfiles}, errors:`, errors);

      return {
        success: syncedProfiles > 0,
        syncedProfiles,
        errors,
        message: `Successfully synced ${mainAddons.length} addons to ${syncedProfiles} profiles`
      };

    } catch (error) {
      console.error(`[addonSync] syncMainToAll error:`, error);
      return {
        success: false,
        syncedProfiles: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        message: 'Sync operation failed'
      };
    }
  }

  async performSync(userId: string): Promise<SyncResult> {
    return this.syncMainToAll(userId);
  }

  cleanup(): void {
    // this.clients.clear(); // No client cache to clear
  }
}

// Export singleton instance
export const addonSyncService = new AddonSyncService();
export type { SyncResult, AddonData };