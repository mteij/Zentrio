/**
 * Addon Sync Service
 * Syncs addons between profiles using the Stremio API proxy
 */

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

interface LoginResponse {
  result?: {
    authKey: string;
    user: {
      _id: string;
      email: string;
      // ... other user properties
    };
    addons?: AddonData[];
    // ... other properties
  };
}

class AddonSyncService {
  /**
   * Login to Stremio using the proxy approach
   */
  private async loginToStremio(profile: any): Promise<string> {
    try {
      // Passwords are encrypted in the DB, so we must always use getDecryptedProfilePassword
      const password = await getDecryptedProfilePassword(profile);
      console.debug(`[addonSync] Logging in profile ${profile.email}...`);
      console.debug(`[addonSync] Credentials: email=${profile.email}, password.length=${password?.length}`);
      
      if (!password || password.length < 4) {
        throw new Error(`Decrypted password for ${profile.email} is empty or too short!`);
      }
      
      // Extra debug: check if email looks valid
      if (!profile.email || !profile.email.includes("@")) {
        throw new Error(`Email for profile is invalid: ${profile.email}`);
      }

      // Login using the same approach as StremioFrame component
      const loginRes = await fetch("http://localhost:8000/stremio/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Login",
          email: profile.email,
          password: password,
          facebook: false,
        }),
      });

      if (!loginRes.ok) {
        let errorMessage = `Login failed with status: ${loginRes.status}`;
        try {
          const errorData = await loginRes.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (_e) {
          // Ignore if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      const loginData: LoginResponse = await loginRes.json();
      const result = loginData?.result;

      // If result is falsy, treat as login failure
      if (!result) {
        throw new Error("Login failed: No result returned from server.");
      }
      
      if (!result.authKey || !result.user?._id) {
        throw new Error("Login failed: Missing authentication data. Please check your credentials.");
      }

      console.debug(`[addonSync] Login successful for ${profile.email}`);
      console.debug(`[addonSync] authKey: ${result.authKey.substring(0, 10)}...`);
      
      return result.authKey;
    } catch (error) {
      console.error(`[addonSync] Failed to login for profile ${profile.email}:`, error);
      throw new Error(`Failed to login for profile ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get addons for a profile using the proxy approach
   */
  private async getProfileAddons(profile: any): Promise<AddonData[]> {
    try {
      const authKey = await this.loginToStremio(profile);
      console.debug(`[addonSync] Pulling addons for profile ${profile.email}...`);
      
      const response = await fetch('http://localhost:8000/stremio/api/addonCollectionGet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'AddonCollectionGet',
          authKey,
          update: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch addons: ${response.statusText}`);
      }

      const data = await response.json();
      console.debug(`[addonSync] Full addon data for ${profile.email}:`, JSON.stringify(data, null, 2));
      if (data.result && Array.isArray(data.result.addons)) {
        const addons = data.result.addons;
        console.debug(`[addonSync] Pulled addons for ${profile.email}:`, addons.length);
        return addons.map((addon: any) => {
          // Preserve all addon properties, not just the ones we explicitly define
          return {
            transportUrl: addon.transportUrl,
            manifest: addon.manifest, // Keep the entire manifest as-is
            flags: addon.flags,
          };
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error(`[addonSync] Failed to get addons for profile ${profile.email}:`, error);
      throw new Error(`Failed to get addons for profile ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set addons for a profile using the proxy approach
   */
  private async setProfileAddons(profile: any, addons: AddonData[]): Promise<void> {
    try {
      const authKey = await this.loginToStremio(profile);
      console.debug(`[addonSync] Setting addons for profile ${profile.email}...`, addons.length);
      
      const response = await fetch('http://localhost:8000/stremio/api/addonCollectionSet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'AddonCollectionSet',
          authKey,
          addons
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to set addons: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.result?.success === false) {
        throw new Error(data.result.error || 'Failed to save changes');
      }

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
      if (!user || !user.settings?.addonSyncSettings?.enabled) {
        return {
          success: false,
          syncedProfiles: 0,
          errors: [],
          message: 'Addon sync is not enabled for this user'
        };
      }

      const { mainProfileId } = user.settings.addonSyncSettings;
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
        console.debug(`[addonSync] Main profile addons:`, mainAddons.length);
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
        'settings.addonSyncSettings.lastSyncAt': new Date()
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
    // No cleanup needed for this approach
  }
}

// Export singleton instance
export const addonSyncService = new AddonSyncService();
export type { SyncResult, AddonData };
