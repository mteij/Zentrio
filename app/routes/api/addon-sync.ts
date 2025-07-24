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

      const syncSettings = user?.settings?.addonSyncSettings || {
        enabled: false,
        syncDirection: 'main_to_all',
        autoSync: false,
        syncInterval: 60
      };

      return new Response(JSON.stringify({
        settings: syncSettings,
        profiles: profiles.map(p => ({
          _id: p._id,
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

      // Validate main profile belongs to user
      if (mainProfileId) {
        const profile = await Profile.findOne({ _id: mainProfileId, userId });
        if (!profile) {
          return new Response("Profile not found or doesn't belong to user", { status: 400 });
        }
      }

      const updateData: any = {};
      if (enabled !== undefined) updateData['settings.addonSyncSettings.enabled'] = enabled;
      if (mainProfileId !== undefined) updateData['settings.addonSyncSettings.mainProfileId'] = mainProfileId;
      if (autoSync !== undefined) updateData['settings.addonSyncSettings.autoSync'] = autoSync;
      if (syncInterval !== undefined) updateData['settings.addonSyncSettings.syncInterval'] = Math.max(5, syncInterval); // Minimum 5 minutes

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
