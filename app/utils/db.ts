import mongoose, { Document, Model, ObjectId } from "mongoose";
import { db } from "./mongo.ts";

// Ensure the database connection is established before defining models
await db;

// --- Interfaces ---
export interface UserSchema extends Document {
  email: string;
  createdAt: Date;
}

export interface ProfileSchema extends Document {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  email: string; // Stremio email
  password: string; // Stremio password, should be stored encrypted
  profilePictureUrl: string;
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
  createdAt: { type: Date, default: Date.now },
});

const profileSchema = new mongoose.Schema<ProfileSchema>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
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

// --- User Functions ---
export const findOrCreateUserByEmail = async (email: string): Promise<UserSchema> => {
  let user = await Users.findOne({ email });
  if (!user) {
    user = await Users.create({ email });
  }
  return user;
};

export const getUserById = async (id: string): Promise<UserSchema | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Users.findById(id).lean();
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

export type { ObjectId };
