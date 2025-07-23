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
  // Encrypted TMDB API key (user-level setting)
  encryptedTmdbApiKey?: EncryptedData;
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
}

export interface SessionSchema extends Document {
  userId: ObjectId;
  expiresAt: Date;
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
  // Encrypted TMDB API key
  encryptedTmdbApiKey: {
    encrypted: { type: String },
    salt: { type: String },
    iv: { type: String },
    tag: { type: String }
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
  profilePictureUrl: { type: String, required: true },
});

const sessionSchema = new mongoose.Schema<SessionSchema>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index
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

// --- Password Functions ---
export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

// --- User Functions ---
export const findUserByEmail = async (email: string): Promise<UserSchema | null> => {
  return await Users.findOne({ email: email.toLowerCase() });
};

export const createUserWithGeneratedPassword = async (email: string): Promise<{ user: UserSchema; plainPassword: string }> => {
  const plainPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await hashPassword(plainPassword);
  const user = await Users.create({ email: email.toLowerCase(), password: hashedPassword });
  return { user, plainPassword };
};

/**
 * @deprecated Use createUserWithGeneratedPassword instead for the new auth flow.
 */
export const createUserWithPassword = async (email: string): Promise<{ user: UserSchema; plainPassword: string }> => {
  const plainPassword = Math.random().toString(36).slice(-8);
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

// --- Session Functions ---
export const createSession = async (userId: string, expiresAt: Date): Promise<string> => {
  const session = await Sessions.create({ userId, expiresAt });
  return (session as { _id: ObjectId })._id.toString();
};

export const getSession = async (sessionId: string): Promise<SessionSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) return null;
  return await Sessions.findById(sessionId).lean();
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
  const updateData: any = { ...data };
  
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
    { $set: { encryptedTmdbApiKey: encryptedApiKey } }
  );
};

/**
 * Get decrypted TMDB API key for user
 */
export const getUserTmdbApiKey = async (userId: string): Promise<string | null> => {
  const user = await Users.findById(userId).lean();
  if (!user?.encryptedTmdbApiKey) {
    return null;
  }
  
  try {
    return await encryptionService.decrypt(user.encryptedTmdbApiKey);
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
    { $unset: { encryptedTmdbApiKey: 1 } }
  );
};

/**
 * Test encryption functionality
 */
export const testDatabaseEncryption = async (): Promise<boolean> => {
  return await encryptionService.testEncryption();
};

export type { ObjectId, EncryptedData };
