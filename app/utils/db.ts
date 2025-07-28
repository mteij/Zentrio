import mongoose, { Document, Model, ObjectId } from "mongoose";
import { connect } from "./mongo.ts";
import * as bcrypt from "$bcrypt/mod.ts";
import type { EncryptedData } from "../shared/services/encryption.ts";

// Ensure the database connection is established before defining models
await connect();

// --- Interfaces ---
export interface UserSchema extends Document {
  email: string;
  password?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  // User settings
  settings?: {
    // Encrypted TMDB API key (user-level setting)
    encryptedTmdbApiKey?: EncryptedData;
    // Encrypted SubDL API key (user-level setting)
    encryptedSubDlApiKey?: EncryptedData;
    // Preferred subtitle language
    subtitleLanguage?: string;
    // Addon manager settings
    addonManagerEnabled?: boolean; // Whether Stremio addon manager userscript is enabled
    // Hide calendar button setting
    hideCalendarButton?: boolean; // Whether to hide the calendar button in the Stremio interface
    // Hide addons button setting
    hideAddonsButton?: boolean; // Whether to hide the addons button in the Stremio interface
    // Mobile player settings
    mobileClickToHover?: boolean; // On mobile, click to show hover menu instead of pausing
    // Downloads settings
    downloadsEnabled?: boolean;
    // Addon sync settings (experimental feature)
    addonSyncSettings?: {
      enabled: boolean;
      mainProfileId?: ObjectId; // Profile to sync addons from
      syncDirection: 'main_to_all' | 'all_to_main'; // Direction of sync
      lastSyncAt?: Date;
      autoSync: boolean; // Whether to sync automatically
    };
  };
}

export interface ProfileSchema extends Document {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  email: string; // Stremio email
  password: string; // Stremio password (legacy - unencrypted)
  encryptedPassword?: EncryptedData; // Stremio password (new - encrypted)
  profilePictureUrl: string;
  nsfwMode?: boolean; // NSFW content filtering enabled
  ageRating?: number; // Age rating for content filtering
}

export interface SessionSchema extends Document {
  userId: ObjectId;
  expiresAt: Date;
  // Enhanced security fields
  ipAddress?: string;
  userAgent?: string;
  fingerprint?: string;
  lastActivity: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface VerificationTokenSchema extends Document {
  userId: ObjectId;
  code: string;
  expiresAt: Date;
}

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema<UserSchema>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  // User settings
  settings: {
    type: {
      // Encrypted TMDB API key
      encryptedTmdbApiKey: {
        encrypted: { type: String },
        salt: { type: String },
        iv: { type: String },
        tag: { type: String }
      },
      // Encrypted SubDL API key
      encryptedSubDlApiKey: {
        encrypted: { type: String },
        salt: { type: String },
        iv: { type: String },
        tag: { type: String }
      },
      // Preferred subtitle language
      subtitleLanguage: { type: String, default: "en" },
      // Addon manager settings
      addonManagerEnabled: { type: Boolean, default: false },
      // Hide calendar button setting
      hideCalendarButton: { type: Boolean, default: false },
      // Hide addons button setting
      hideAddonsButton: { type: Boolean, default: false },
      // Mobile player settings
      mobileClickToHover: { type: Boolean, default: false },
      // Downloads settings
      downloadsEnabled: { type: Boolean, default: false },
      // Addon sync settings (experimental feature)
      addonSyncSettings: {
        enabled: { type: Boolean, default: false },
        mainProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" },
        syncDirection: { type: String, enum: ['main_to_all', 'all_to_main'], default: 'main_to_all' },
        lastSyncAt: { type: Date },
        autoSync: { type: Boolean, default: false }
      }
    },
    default: {}
  }
});

const profileSchema = new mongoose.Schema<ProfileSchema>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String }, // Legacy field (backward compatibility)
  // New encrypted password field
  encryptedPassword: {
    encrypted: { type: String },
    salt: { type: String },
    iv: { type: String },
    tag: { type: String }
  },
  nsfwMode: { type: Boolean, default: false },
  ageRating: { type: Number, default: 0 },
  profilePictureUrl: { type: String, required: true },
});

const sessionSchema = new mongoose.Schema<SessionSchema>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index
  // Enhanced security fields
  ipAddress: { type: String },
  userAgent: { type: String },
  fingerprint: { type: String },
  lastActivity: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, required: true, default: Date.now },
  isActive: { type: Boolean, required: true, default: true },
});

const verificationTokenSchema = new mongoose.Schema<VerificationTokenSchema>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index
});

// --- Models ---
const Users: Model<UserSchema> = mongoose.models.User || mongoose.model("User", userSchema);
const Profiles: Model<ProfileSchema> = mongoose.models.Profile || mongoose.model("Profile", profileSchema);
const Sessions: Model<SessionSchema> = mongoose.models.Session || mongoose.model("Session", sessionSchema);
export const VerificationTokens: Model<VerificationTokenSchema> = mongoose.models.VerificationToken ||
  mongoose.model("VerificationToken", verificationTokenSchema);

// Export models for external use
export const User = Users;
export const Profile = Profiles;
export const Session = Sessions;

// --- Password Functions ---
export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate a cryptographically secure random password
 * @param length Password length (default: 12)
 * @returns Secure random password
 */
const generateSecurePassword = (length: number = 12): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
};

// --- User Functions ---
export const findUserByEmail = async (email: string): Promise<UserSchema | null> => {
  return await Users.findOne({ email: email.toLowerCase() });
};

export const createUserWithGeneratedPassword = async (email: string): Promise<{ user: UserSchema; plainPassword: string }> => {
  const plainPassword = generateSecurePassword(12); // Generate 12-character secure password
  const hashedPassword = await hashPassword(plainPassword);
  const user = await Users.create({ email: email.toLowerCase(), password: hashedPassword });
  return { user, plainPassword };
};

/**
 * @deprecated Use createUserWithGeneratedPassword instead for the new auth flow.
 */
export const createUserWithPassword = async (email: string): Promise<{ user: UserSchema; plainPassword: string }> => {
  const plainPassword = generateSecurePassword(12); // Generate 12-character secure password
  const hashedPassword = await hashPassword(plainPassword);
  const user = await Users.create({ email: email.toLowerCase(), password: hashedPassword });
  return { user, plainPassword };
};

export const getUserById = async (id: string): Promise<UserSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Users.findById(id).lean();
};

export const updateUserPassword = async (userId: string, newPassword_plain: string) => {
  const password = await hashPassword(newPassword_plain);
  await Users.updateOne({ _id: userId }, { $set: { password }, $unset: { passwordResetToken: "", passwordResetExpires: "" } });
};

export const createPasswordResetTokenForUser = async (userId: string): Promise<string> => {
  const resetToken = crypto.randomUUID();
  const passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
  await Users.updateOne({ _id: userId }, { $set: { passwordResetToken: resetToken, passwordResetExpires } });
  return resetToken;
};

export const findUserByPasswordResetToken = async (token: string): Promise<UserSchema | null> => {
  return await Users.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } });
};

export const deleteUser = async (userId: string) => {
 if (!mongoose.Types.ObjectId.isValid(userId)) return;
 const userObjectId = new mongoose.Types.ObjectId(userId);

 // Start a session for transaction
 const session = await mongoose.startSession();
 session.startTransaction();
 try {
   // Delete all profiles associated with the user
   await Profiles.deleteMany({ userId: userObjectId }).session(session);

   // Delete the user
   await Users.deleteOne({ _id: userObjectId }).session(session);

   // Commit the transaction
   await session.commitTransaction();
 } catch (error) {
   // If an error occurred, abort the transaction
   await session.abortTransaction();
   console.error("Error deleting user and profiles:", error);
   throw error; // Re-throw the error to be handled by the caller
 } finally {
   // End the session
   session.endSession();
 }
};

// --- Session Functions ---
import { sessionSecurity } from "../shared/services/sessionSecurity.ts";

export const createSession = async (
  userId: string, 
  expiresAt: Date, 
  request?: Request
): Promise<string> => {
  // Generate secure session ID
  const secureSessionId = sessionSecurity.generateSecureSessionId();
  
  // Extract security data from request if provided
  let securityData = {};
  if (request) {
    const extracted = sessionSecurity.extractSecurityData(request);
    securityData = {
      ipAddress: extracted.ipAddress,
      userAgent: extracted.userAgent,
      fingerprint: extracted.fingerprint,
    };
  }

  const session = await Sessions.create({ 
    _id: new mongoose.Types.ObjectId(secureSessionId.slice(0, 24).padEnd(24, '0')),
    userId, 
    expiresAt,
    ...securityData,
    lastActivity: new Date(),
    createdAt: new Date(),
    isActive: true
  });
  
  return (session as { _id: { toString(): string } })._id.toString();
};

export const getSession = async (sessionId: string, request?: Request): Promise<SessionSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) return null;
  
  const session = await Sessions.findById(sessionId).lean();
  if (!session) return null;

  // Enhanced security validation
  if (request) {
    const currentSecurityData = sessionSecurity.extractSecurityData(request);
    const storedSecurityData = {
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      fingerprint: session.fingerprint,
    };

    const validation = sessionSecurity.validateSessionSecurity(storedSecurityData, currentSecurityData);
    if (!validation.isValid) {
      console.warn(`Session security validation failed: ${validation.reason}`);
      // Invalidate the session
      await Sessions.updateOne({ _id: sessionId }, { $set: { isActive: false } });
      return null;
    }

    // Update last activity
    await Sessions.updateOne({ _id: sessionId }, { $set: { lastActivity: new Date() } });
  }

  // Check if session is still active
  if (!session.isActive) {
    return null;
  }

  // Check for inactivity timeout
  if (sessionSecurity.isSessionExpiredByInactivity(session.lastActivity)) {
    await Sessions.updateOne({ _id: sessionId }, { $set: { isActive: false } });
    return null;
  }

  return session;
};

/**
 * Invalidate all sessions for a user
 */
export const invalidateAllUserSessions = async (userId: string): Promise<void> => {
  await Sessions.updateMany(
    { userId: new mongoose.Types.ObjectId(userId) },
    { $set: { isActive: false } }
  );
};

/**
 * Invalidate a specific session
 */
export const invalidateSession = async (sessionId: string): Promise<void> => {
  await Sessions.updateOne(
    { _id: sessionId },
    { $set: { isActive: false } }
  );
};

/**
 * Get all active sessions for a user
 */
export const getUserActiveSessions = async (userId: string): Promise<SessionSchema[]> => {
  return await Sessions.find({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).lean();
};

/**
 * Clean up inactive/expired sessions
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  const result = await Sessions.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false },
      { lastActivity: { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } } // 2 hours inactive
    ]
  });
  return result.deletedCount || 0;
};

/**
 * Detect and handle suspicious session activity
 */
export const detectSuspiciousActivity = async (userId: string): Promise<boolean> => {
  const sessions = await getUserActiveSessions(userId);
  const suspiciousActivity = sessionSecurity.detectSuspiciousActivity(
    sessions.map(s => ({
      userId: s.userId.toString(),
      sessionId: (s as { _id: { toString(): string } })._id.toString(),
      expiresAt: s.expiresAt,
      lastActivity: s.lastActivity,
      isActive: s.isActive,
      securityData: {
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        fingerprint: s.fingerprint,
      }
    })),
    { ipAddress: 'current', userAgent: 'current', fingerprint: 'current' }
  );

  if (suspiciousActivity.isSuspicious) {
    console.warn(`Suspicious activity detected for user ${userId}: ${suspiciousActivity.reason}`);
    // Optionally invalidate all sessions or send alert
    return true;
  }

  return false;
};

// --- Verification Token Functions ---
export const createVerificationToken = async (
  userId: string,
  expiresAt: Date,
): Promise<{ token: string; code: string }> => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenDoc = await VerificationTokens.create({
    userId,
    code,
    expiresAt,
  });
  
  // Development logging - show the verification code in terminal
  console.log(`🔐 DEVELOPMENT: Verification code generated: ${code} for user ${userId}`);
  
  return { token: (tokenDoc as { _id: ObjectId })._id.toString(), code };
};

export const getVerificationToken = async (
  tokenId: string,
): Promise<VerificationTokenSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(tokenId)) return null;
  return await VerificationTokens.findById(tokenId).lean();
};

export const deleteVerificationToken = async (tokenId: string) => {
  if (!mongoose.Types.ObjectId.isValid(tokenId)) return;
  await VerificationTokens.findByIdAndDelete(tokenId);
};

// --- Profile Functions ---
export const getProfilesByUser = async (userId: string): Promise<ProfileSchema[]> => {
  return await Profiles.find({ userId }).lean();
};

export const createProfile = async (profileData: {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  profilePictureUrl: string;
}): Promise<ProfileSchema> => {
  return await Profiles.create(profileData);
};

export const getProfile = async (id: string): Promise<ProfileSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Profiles.findById(id).lean();
};

export const updateProfile = async (
  id: string,
  userId: string,
  data: Partial<Omit<ProfileSchema, "_id" | "userId">>,
) => {
  await Profiles.updateOne(
    { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
    { $set: data },
  );
};

export const deleteProfile = async (id: string, userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) return;
  await Profiles.deleteOne({ _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) });
};

// --- Encryption Functions ---
import { encryptionService } from "../shared/services/encryption.ts";

/**
 * Create a profile with encrypted password
 */
export const createEncryptedProfile = async (profileData: {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  profilePictureUrl: string;
  nsfwMode?: boolean;
  ageRating?: number;
}): Promise<ProfileSchema> => {
  const encryptedPassword = await encryptionService.encrypt(profileData.password);
  
  return await Profiles.create({
    ...profileData,
    password: undefined, // Don't store plain text
    encryptedPassword,
  });
};

/**
 * Update a profile with encrypted password
 */
export const updateEncryptedProfile = async (
  id: string,
  userId: string,
  data: Partial<Omit<ProfileSchema, "_id" | "userId">>,
) => {
  const updateData: Partial<Omit<ProfileSchema, "_id" | "userId">> = { ...data };
  
  // If password is being updated, encrypt it
  if (data.password) {
    updateData.encryptedPassword = await encryptionService.encrypt(data.password);
    updateData.password = undefined; // Remove plain text password
  }

  await Profiles.updateOne(
    { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
    { $set: updateData },
  );
};

/**
 * Get decrypted password for a profile
 */
export const getDecryptedProfilePassword = async (profile: ProfileSchema): Promise<string> => {
  // Try new encrypted field first
  if (profile.encryptedPassword) {
    return await encryptionService.decrypt(profile.encryptedPassword);
  }
  
  // Fall back to legacy unencrypted field
  if (profile.password) {
    console.warn(`Profile ${profile._id} using legacy unencrypted password`);
    return profile.password;
  }
  
  throw new Error('No password found for profile');
};

/**
 * Migrate profile from unencrypted to encrypted password
 */
export const migrateProfileToEncrypted = async (profileId: string): Promise<boolean> => {
  const profile = await Profiles.findById(profileId);
  if (!profile || !profile.password || profile.encryptedPassword) {
    return false; // Already migrated or no password to migrate
  }

  try {
    const encryptedPassword = await encryptionService.encrypt(profile.password);
    await Profiles.updateOne(
      { _id: profileId },
      { 
        $set: { encryptedPassword },
        $unset: { password: 1 } // Remove plain text password
      }
    );
    return true;
  } catch (error) {
    console.error(`Failed to migrate profile ${profileId}:`, error);
    return false;
  }
};

/**
 * Set encrypted TMDB API key for user
 */
export const setUserTmdbApiKey = async (userId: string, apiKey: string): Promise<void> => {
  const encryptedApiKey = await encryptionService.encrypt(apiKey);
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.encryptedTmdbApiKey': encryptedApiKey } }
  );
};

/**
 * Get decrypted TMDB API key for user
 */
export const getUserTmdbApiKey = async (userId: string): Promise<string | null> => {
  const user = await Users.findById(userId).lean();
  if (!user?.settings?.encryptedTmdbApiKey) {
    return null;
  }
  
  try {
    return await encryptionService.decrypt(user.settings.encryptedTmdbApiKey);
  } catch (error) {
    console.error(`Failed to decrypt TMDB API key for user ${userId}:`, error);
    return null;
  }
};

/**
 * Remove TMDB API key for user
 */
export const removeUserTmdbApiKey = async (userId: string): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $unset: { 'settings.encryptedTmdbApiKey': 1 } }
  );
};

/**
 * Set encrypted SubDL API key for user
 */
export const setUserSubDlApiKey = async (userId: string, apiKey: string): Promise<void> => {
    const encryptedApiKey = await encryptionService.encrypt(apiKey);
    await Users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { 'settings.encryptedSubDlApiKey': encryptedApiKey } }
    );
};

/**
 * Get decrypted SubDL API key for user
 */
export const getUserSubDlApiKey = async (userId: string): Promise<string | null> => {
    const user = await Users.findById(userId).lean();
    if (!user?.settings?.encryptedSubDlApiKey) {
        return null;
    }
    
    try {
        return await encryptionService.decrypt(user.settings.encryptedSubDlApiKey);
    } catch (error) {
        console.error(`Failed to decrypt SubDL API key for user ${userId}:`, error);
        return null;
    }
};

/**
 * Set subtitle language for user
 */
export const setUserSubtitleLanguage = async (userId: string, language: string): Promise<void> => {
    await Users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { 'settings.subtitleLanguage': language } }
    );
};

/**
 * Get subtitle language for user
 */
export const getUserSubtitleLanguage = async (userId: string): Promise<string> => {
    const user = await Users.findById(userId).lean();
    return user?.settings?.subtitleLanguage || "en";
};


/**
 * Test encryption functionality
 */
export const testDatabaseEncryption = async (): Promise<boolean> => {
  return await encryptionService.testEncryption();
};

/**
 * Get addon sync settings for user
 */
export const getUserAddonSyncSettings = async (userId: string) => {
  const user = await Users.findById(userId);
  return user?.settings?.addonSyncSettings || {
    enabled: false,
    syncDirection: 'main_to_all',
    autoSync: false
  };
};

/**
 * Update addon sync settings for user
 */
export const updateUserAddonSyncSettings = async (
  userId: string, 
  settings: Partial<UserSchema['settings']['addonSyncSettings' & keyof UserSchema['settings']]>
): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  
  Object.entries(settings).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[`settings.addonSyncSettings.${key}`] = value;
    }
  });

  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: updateData }
  );
};

/**
 * Check if user can perform addon sync
 */
export const canUserPerformAddonSync = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return !!(user?.settings?.addonSyncSettings?.enabled && user?.settings?.addonSyncSettings?.mainProfileId);
};

/**
 * Update addon manager setting for user
 */
export const updateUserAddonManagerSetting = async (userId: string, enabled: boolean): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.addonManagerEnabled': enabled } }
  );
};

/**
 * Get addon manager setting for user
 */
export const getUserAddonManagerSetting = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return user?.settings?.addonManagerEnabled || false;
};

/**
 * Update hide calendar button setting for user
 */
export const updateUserHideCalendarButtonSetting = async (userId: string, hide: boolean): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.hideCalendarButton': hide } }
  );
};

/**
 * Get hide calendar button setting for user
 */
export const getUserHideCalendarButtonSetting = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return user?.settings?.hideCalendarButton || false;
};

/**
 * Update hide addons button setting for user
 */
export const updateUserHideAddonsButtonSetting = async (userId: string, hide: boolean): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.hideAddonsButton': hide } }
  );
};

/**
 * Get hide addons button setting for user
 */
export const getUserHideAddonsButtonSetting = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return user?.settings?.hideAddonsButton || false;
};

/**
 * Update mobile click to hover setting for user
 */
export const updateUserMobileClickToHoverSetting = async (userId: string, enabled: boolean): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.mobileClickToHover': enabled } }
  );
};

/**
 * Get mobile click to hover setting for user
 */
export const getUserMobileClickToHoverSetting = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return user?.settings?.mobileClickToHover || false;
};

/**
 * Update downloads enabled setting for user
 */
export const setUserDownloadsEnabled = async (userId: string, enabled: boolean): Promise<void> => {
  await Users.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { 'settings.downloadsEnabled': enabled } }
  );
};

/**
 * Get downloads enabled setting for user
 */
export const getUserDownloadsEnabled = async (userId: string): Promise<boolean> => {
  const user = await Users.findById(userId);
  return user?.settings?.downloadsEnabled || false;
};

export type { ObjectId, EncryptedData };
