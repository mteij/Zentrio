import { Handlers } from "$fresh/server.ts";
import { AppState } from "../_middleware.ts";
import { User, Profile } from "../../utils/db.ts";
import { addonSyncService } from "../../shared/services/addonSync.ts";

export const handler: Handlers<null, AppState> = {
  /**
   * Get addon sync settings
   */
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const user = await User.findById(userId).populate('settings.addonSyncSettings.mainProfileId');
      const profiles = await Profile.find({ userId });

      // Ensure mainProfileId is properly converted to string if it's an ObjectId
      const syncSettings = user?.settings?.addonSyncSettings || {
        enabled: false,
        syncDirection: 'main_to_all',
        autoSync: false,
        syncInterval: 60
      };

      // Handle corrupted mainProfileId data
      let mainProfileIdValue = null;
      if (syncSettings.mainProfileId) {
        // If it's already a string that looks like an ObjectId, use it directly
        if (typeof syncSettings.mainProfileId === 'string' && /^[0-9a-fA-F]{24}$/.test(syncSettings.mainProfileId)) {
          mainProfileIdValue = syncSettings.mainProfileId;
        } 
        // If it's an ObjectId, convert to string
        else if (syncSettings.mainProfileId.toString && typeof syncSettings.mainProfileId.toString === 'function') {
          try {
            mainProfileIdValue = syncSettings.mainProfileId.toString();
            // If toString() returns the object representation, extract just the ID
            if (mainProfileIdValue.includes('ObjectId(')) {
              const match = mainProfileIdValue.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
              if (match && match[1]) {
                mainProfileIdValue = match[1];
              }
            }
          } catch (e) {
            // If conversion fails, set to null
            mainProfileIdValue = null;
          }
        }
      }

      // Create a copy of syncSettings with properly handled mainProfileId
      const serializedSettings = {
        ...syncSettings,
        mainProfileId: mainProfileIdValue
      };

      return new Response(JSON.stringify({
        settings: serializedSettings,
        profiles: profiles.map(p => ({
          _id: p._id.toString(),
          name: p.name,
          email: p.email
        }))
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error fetching addon sync settings:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Update addon sync settings
   */
  async PUT(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { enabled, mainProfileId, autoSync, syncInterval } = await req.json();

      // Validate and sanitize mainProfileId
      let sanitizedMainProfileId = null;
      if (mainProfileId) {
        // If mainProfileId is an object, extract the _id
        if (typeof mainProfileId === 'object' && mainProfileId._id) {
          sanitizedMainProfileId = mainProfileId._id;
        } else if (typeof mainProfileId === 'string') {
          sanitizedMainProfileId = mainProfileId;
        }
        
        // Validate main profile belongs to user
        if (sanitizedMainProfileId) {
          const profile = await Profile.findOne({ _id: sanitizedMainProfileId, userId });
          if (!profile) {
            return new Response("Profile not found or doesn't belong to user", { status: 400 });
          }
        }
      }

      // Validate and sanitize syncInterval
      let sanitizedSyncInterval = 60;
      if (syncInterval !== undefined) {
        sanitizedSyncInterval = Math.max(5, Math.min(1440, Number(syncInterval) || 60)); // Between 5 and 1440 minutes
      }

      const updateData: any = {};
      if (enabled !== undefined) updateData['settings.addonSyncSettings.enabled'] = Boolean(enabled);
      if (sanitizedMainProfileId !== undefined) updateData['settings.addonSyncSettings.mainProfileId'] = sanitizedMainProfileId || null;
      if (autoSync !== undefined) updateData['settings.addonSyncSettings.autoSync'] = Boolean(autoSync);
      if (syncInterval !== undefined) updateData['settings.addonSyncSettings.syncInterval'] = sanitizedSyncInterval;

      await User.findByIdAndUpdate(userId, updateData);

      return new Response(JSON.stringify({ 
        success: true,
        message: "Addon sync settings updated successfully"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error updating addon sync settings:', error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Trigger manual sync
   */
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { action } = await req.json();

      let result;
      // Only allow 'sync' and 'sync_main_to_all'
      switch (action) {
        case 'sync':
        case 'sync_main_to_all':
          result = await addonSyncService.syncMainToAll(userId);
          break;
        default:
          return new Response("Invalid action", { status: 400 });
      }

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error('Error performing addon sync:', error);
      return new Response("Internal server error", { status: 500 });
    }
  }
};
