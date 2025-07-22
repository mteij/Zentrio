const kv = await Deno.openKv();

export interface User {
  id: string;
  email: string;
  hashedPassword: string;
  createdAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string; // Stremio email
  password: string; // Stremio password, should be stored encrypted
  profilePictureUrl: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface VerificationToken {
  id: string;
  userId: string;
  expiresAt: Date;
}

// --- User Functions ---
export const findOrCreateUserByEmail = async (email: string): Promise<User> => {
  const user = await getUserByEmail(email);
  if (user) return user;

  const newUser: User = {
    id: crypto.randomUUID(),
    email,
    // No password needed for email link auth
    hashedPassword: "", 
    createdAt: new Date(),
  };
  await createUser(newUser);
  return newUser;
};

export const createUser = async (user: User) => {
  await kv.set(["users", user.id], user);
  await kv.set(["users_by_email", user.email], user);
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const res = await kv.get<User>(["users_by_email", email]);
  return res.value;
};

// --- Session Functions ---
export const createSession = async (session: Session) => {
  await kv.set(["sessions", session.id], session, {
    expireIn: session.expiresAt.getTime() - Date.now(),
  });
};

export const getSession = async (sessionId: string): Promise<Session | null> => {
  const res = await kv.get<Session>(["sessions", sessionId]);
  return res.value;
};

// --- Verification Token Functions ---
export const createVerificationToken = async (
  token: VerificationToken,
) => {
  await kv.set(["verification_tokens", token.id], token, {
    expireIn: token.expiresAt.getTime() - Date.now(),
  });
};

export const getVerificationToken = async (
  tokenId: string,
): Promise<VerificationToken | null> => {
  const res = await kv.get<VerificationToken>(["verification_tokens", tokenId]);
  return res.value;
};

export const deleteVerificationToken = async (tokenId: string) => {
  await kv.delete(["verification_tokens", tokenId]);
};
