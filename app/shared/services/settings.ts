import mongoose from "mongoose";
import { User, UserSchema } from "../../utils/db.ts";
import { encryptionService } from "./encryption.ts";

// Define the shape of a setting value
export type SettingValue = string | boolean | number | Record<string, unknown> | null;

// Define the interface for a setting handler
export interface SettingHandler<T extends SettingValue> {
  get: (user: UserSchema) => Promise<T | Partial<T>>;
  set: (userId: string, value: T) => Promise<void>;
  validate?: (value: unknown) => boolean;
}

// Create the settings registry
export const settingsRegistry: Record<string, SettingHandler<SettingValue>> = {
  // TMDB API Key Setting
  tmdbApiKey: {
    get: async (user) => {
      if (!user.settings?.encryptedTmdbApiKey || !user.settings.encryptedTmdbApiKey.encrypted) return "";
      try {
        return await encryptionService.decrypt(user.settings.encryptedTmdbApiKey);
      } catch (error) {
        console.error(`Failed to decrypt TMDB API key for user ${user._id}:`, error);
        return "";
      }
    },
    set: async (userId, value) => {
      if (typeof value !== 'string') throw new Error("Invalid API key format");
      if (value === '') {
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $unset: { 'settings.encryptedTmdbApiKey': 1 } });
      } else {
        const encryptedApiKey = await encryptionService.encrypt(value as string);
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.encryptedTmdbApiKey': encryptedApiKey } });
      }
    },
    validate: (value) => {
        if (typeof value !== 'string') return false;
        if (value === '') return true; // Allow empty string
        return value.length > 20 && value.length < 50;
    },
  },

  // SubDL API Key Setting
  subDlApiKey: {
    get: async (user) => {
      if (!user.settings?.encryptedSubDlApiKey || !user.settings.encryptedSubDlApiKey.encrypted) return "";
      try {
        return await encryptionService.decrypt(user.settings.encryptedSubDlApiKey);
      } catch (error) {
        console.error(`Failed to decrypt SubDL API key for user ${user._id}:`, error);
        return "";
      }
    },
    set: async (userId, value) => {
      if (typeof value !== 'string') throw new Error("Invalid API key format");
      if (value === '') {
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $unset: { 'settings.encryptedSubDlApiKey': 1 } });
      } else {
        const encryptedApiKey = await encryptionService.encrypt(value as string);
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.encryptedSubDlApiKey': encryptedApiKey } });
      }
    },
    validate: (value) => {
        if (typeof value !== 'string') return false;
        return true; // Allow any string
    },
  },

  // Subtitle Language Setting
  subtitleLanguage: {
    get: (user) => Promise.resolve(user.settings?.subtitleLanguage || "en"),
    set: async (userId, value) => {
      await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.subtitleLanguage': value } });
    },
    validate: (value) => typeof value === 'string',
  },

  // Hide Calendar Button Setting
  hideCalendarButton: {
    get: (user) => Promise.resolve(user.settings?.hideCalendarButton || false),
    set: async (userId, value) => {
      await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.hideCalendarButton': value } });
    },
    validate: (value) => typeof value === 'boolean',
  },

  // Hide Addons Button Setting
  hideAddonsButton: {
    get: (user) => Promise.resolve(user.settings?.hideAddonsButton || false),
    set: async (userId, value) => {
      await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.hideAddonsButton': value } });
    },
    validate: (value) => typeof value === 'boolean',
  },

  // Mobile Click to Hover Setting
  mobileClickToHover: {
    get: (user) => Promise.resolve(user.settings?.mobileClickToHover || false),
    set: async (userId, value) => {
      await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.mobileClickToHover': value } });
    },
    validate: (value) => typeof value === 'boolean',
  },

  // Addon Sync Settings
  addonSyncEnabled: {
    get: (user) => Promise.resolve(user.settings?.addonSyncSettings?.enabled || false),
    set: async (userId, value) => {
      await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.addonSyncSettings.enabled': value } });
    },
    validate: (value) => typeof value === 'boolean',
  },

  addonSyncData: {
    get: (user) => {
            return Promise.resolve({
                mainProfileId: user.settings?.addonSyncSettings?.mainProfileId || null,
                autoSync: user.settings?.addonSyncSettings?.autoSync || false,
                lastSyncAt: user.settings?.addonSyncSettings?.lastSyncAt || null,
            });
        },
    set: async (userId, value) => {
        if (typeof value !== 'object' || value === null) throw new Error("Invalid settings format");
        const updateData: Record<string, unknown> = {};
        if (value.mainProfileId !== undefined) {
            updateData['settings.addonSyncSettings.mainProfileId'] = value.mainProfileId;
        }
        if (value.autoSync !== undefined) {
            updateData['settings.addonSyncSettings.autoSync'] = value.autoSync;
        }
        if (Object.keys(updateData).length > 0) {
            await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: updateData });
        }
    },
    validate: (value) => typeof value === 'object' && value !== null,
  },

  // Addon Manager Enabled Setting
  addonOrderEnabled: {
    get: (user) => Promise.resolve(user.settings?.addonManagerEnabled || false),
    set: async (userId, value) => {
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.addonManagerEnabled': value } });
    },
    validate: (value) => typeof value === 'boolean',
  },

  // Downloads Manager Enabled Setting
  downloadsEnabled: {
    get: (user) => Promise.resolve(user.settings?.downloadsEnabled || false),
    set: async (userId, value) => {
        await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { 'settings.downloadsEnabled': value } });
    },
    validate: (value) => typeof value === 'boolean',
  }
};