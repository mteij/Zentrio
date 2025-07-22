import { db } from "./mongo.ts";
import { ObjectId } from "mongodb";

// --- Interfaces ---
export interface UserSchema {
  _id: ObjectId;
  email: string;
  createdAt: Date;
}

export interface ProfileSchema {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  email: string; // Stremio email
  password: string; // Stremio password, should be stored encrypted
  profilePictureUrl: string;
}

export interface SessionSchema {
  _id: ObjectId;
  userId: ObjectId;
  expiresAt: Date;
}

export interface VerificationTokenSchema {
  _id: ObjectId;
  userId: ObjectId;
  expiresAt: Date;
}

// --- Collections ---
const Users = db.collection<UserSchema>("users");
const Profiles = db.collection<ProfileSchema>("profiles");
const Sessions = db.collection<SessionSchema>("sessions");
const VerificationTokens = db.collection<VerificationTokenSchema>(
  "verification_tokens",
);

// Create TTL index for sessions and tokens to auto-expire
await Sessions.createIndexes({ indexes: [{ key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 }] });
await VerificationTokens.createIndexes({ indexes: [{ key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 }] });

// --- User Functions ---
export const findOrCreateUserByEmail = async (email: string): Promise<UserSchema> => {
  const user = await Users.findOne({ email });
  if (user) return user;

  const newUser = {
    email,
    createdAt: new Date(),
  };
  const id = await Users.insertOne(newUser);
  return { ...newUser, _id: id };
};

export const getUserById = async (id: string): Promise<UserSchema | null> => {
  const user = await Users.findOne({ _id: new ObjectId(id) });
  return user ?? null;
};

// --- Session Functions ---
export const createSession = async (userId: string, expiresAt: Date): Promise<string> => {
  const session = {
    userId: new ObjectId(userId),
    expiresAt,
  };
  const id = await Sessions.insertOne(session);
  return id.toHexString();
};

export const getSession = async (sessionId: string): Promise<SessionSchema | null> => {
  try {
    const session = await Sessions.findOne({ _id: new ObjectId(sessionId) });
    return session ?? null;
  } catch {
    return null; // Invalid ObjectId
  }
};

// --- Verification Token Functions ---
export const createVerificationToken = async (userId: string, expiresAt: Date): Promise<string> => {
  const token = {
    userId: new ObjectId(userId),
    expiresAt,
  };
  const id = await VerificationTokens.insertOne(token);
  return id.toHexString();
};

export const getVerificationToken = async (tokenId: string): Promise<VerificationTokenSchema | null> => {
  try {
    const token = await VerificationTokens.findOne({ _id: new ObjectId(tokenId) });
    return token ?? null;
  } catch {
    return null; // Invalid ObjectId
  }
};

export const deleteVerificationToken = async (tokenId: string) => {
  await VerificationTokens.deleteOne({ _id: new ObjectId(tokenId) });
};

// --- Profile Functions ---
export const getProfilesByUser = async (userId: string): Promise<ProfileSchema[]> => {
  return await Profiles.find({ userId: new ObjectId(userId) }).toArray();
};

export const createProfile = async (profileData: Omit<ProfileSchema, "_id">): Promise<ProfileSchema> => {
  const id = await Profiles.insertOne(profileData);
  return { ...profileData, _id: id };
};

export const getProfile = async (id: string): Promise<ProfileSchema | null> => {
  try {
    const profile = await Profiles.findOne({ _id: new ObjectId(id) });
    return profile ?? null;
  } catch {
    return null; // Invalid ObjectId
  }
};

export const updateProfile = async (
  id: string,
  userId: string,
  data: Partial<Omit<ProfileSchema, "_id" | "userId">>,
) => {
  await Profiles.updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: data },
  );
};

export const deleteProfile = async (id: string, userId: string) => {
  await Profiles.deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
};
