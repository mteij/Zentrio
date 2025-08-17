export function getRandomFunEmojiUrl(name: string): string {
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name + seed)}`;
}

export function getInitialsUrl(name: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

export function handleProfileClick(profileId: string): void {
  try {
    localStorage.setItem("lastProfileId", profileId);
  } catch {
    //
  }
  globalThis.location.href = `/player/${profileId}`;
}

export function getProfileCardStyles(isMobile: boolean) {
  return {
    width: isMobile ? "120px" : "220px",
    avatarSize: isMobile ? "100px" : "120px",
    fontSize: isMobile ? "text-sm" : "text-lg",
    spacing: isMobile ? "gap-4" : "gap-8"
  };
}

export function validateProfileData(data: { name: string; email?: string; password?: string }) {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push("Profile name is required");
  }
  
  if (data.name && data.name.trim().length > 50) {
    errors.push("Profile name must be 50 characters or less");
  }
  
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.push("Invalid email format");
  }
  
  if (data.password && data.password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }
  
  return errors;
}