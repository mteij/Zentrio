import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import { twoFactor, magicLink, emailOTP, openAPI, oidcProvider } from "better-auth/plugins";
import { getConfig } from "./envParser";
import { join, isAbsolute, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { emailService } from "./email";

const cfg = getConfig();
let dbPath = cfg.DATABASE_URL || './data/zentrio.db';

if (!isAbsolute(dbPath)) {
  dbPath = join(process.cwd(), dbPath);
}

try {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
} catch (_) { /* best-effort */ }

const db = new Database(dbPath);

export const auth = betterAuth({
    baseURL: cfg.APP_URL,
    basePath: "/api/auth",
    trustedOrigins: [
        "tauri://localhost",
        "zentrio://",
        "http://localhost:3000",
        "http://localhost:5173",
        cfg.APP_URL,
        cfg.CLIENT_URL
    ],
    database: db,
    advanced: {
        defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
        },
        crossSubDomainCookies: {
            enabled: true
        },
        cookiePrefix: "better-auth",
        useSecureCookies: true
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60
        }
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async sendResetPassword({ user, url, token }: any, request: any) {
            await emailService.sendResetPasswordEmail(user.email, url);
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        async sendVerificationEmail({ user, url, token }: any, request: any) {
            // We use OTP now, but keep this as fallback or for specific flows if needed
            // The actual OTP sending is handled by emailOTP plugin
        },
    },
    socialProviders: {
        google: {
            enabled: !!cfg.GOOGLE_CLIENT_ID && !!cfg.GOOGLE_CLIENT_SECRET,
            clientId: cfg.GOOGLE_CLIENT_ID || "",
            clientSecret: cfg.GOOGLE_CLIENT_SECRET || "",
            redirectURI: `${cfg.APP_URL}/api/auth/callback/google`,
        },
        github: {
            enabled: !!cfg.GITHUB_CLIENT_ID && !!cfg.GITHUB_CLIENT_SECRET,
            clientId: cfg.GITHUB_CLIENT_ID || "",
            clientSecret: cfg.GITHUB_CLIENT_SECRET || "",
            redirectURI: `${cfg.APP_URL}/api/auth/callback/github`,
        },
        discord: {
            enabled: !!cfg.DISCORD_CLIENT_ID && !!cfg.DISCORD_CLIENT_SECRET,
            clientId: cfg.DISCORD_CLIENT_ID || "",
            clientSecret: cfg.DISCORD_CLIENT_SECRET || "",
            redirectURI: `${cfg.APP_URL}/api/auth/callback/discord`,
        },
        oidc: {
            enabled: !!cfg.OIDC_CLIENT_ID && !!cfg.OIDC_CLIENT_SECRET && !!cfg.OIDC_ISSUER,
            clientId: cfg.OIDC_CLIENT_ID || "",
            clientSecret: cfg.OIDC_CLIENT_SECRET || "",
            issuer: cfg.OIDC_ISSUER || "",
            redirectURI: `${cfg.APP_URL}/api/auth/callback/oidc`,
        },
    },
    plugins: [
        twoFactor({
            issuer: "Zentrio",
        }),
        magicLink({
            sendMagicLink: async ({ email, token, url }, request) => {
                await emailService.sendMagicLink(email, url);
            }
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                await emailService.sendOTP(email, otp);
            },
        }),
        openAPI(),
        oidcProvider({
            loginPage: "/login",
        })
    ],
    user: {
        changeEmail: {
            enabled: true,
        },
        deleteUser: {
            enabled: true,
        },
        additionalFields: {
            username: {
                type: "string",
                required: false,
            },
            firstName: {
                type: "string",
                required: false,
            },
            lastName: {
                type: "string",
                required: false,
            },
            addonManagerEnabled: {
                type: "boolean",
                defaultValue: false,
            },
            hideCalendarButton: {
                type: "boolean",
                defaultValue: false,
            },
            hideAddonsButton: {
                type: "boolean",
                defaultValue: false,
            },
            hideCinemetaContent: {
                type: "boolean",
                defaultValue: false,
            },
        }
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github", "discord", "oidc"],
            allowDifferentEmails: true,
        },
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    if (user.email) {
                        user.email = user.email.toLowerCase();
                    }
                    if (!user.username && user.email) {
                        user.username = user.email.split('@')[0];
                    }
                    return {
                        data: user
                    }
                },
                after: async (user) => {
                    // Auto-create default settings profile
                    try {
                        const { settingsProfileDb, profileDb, profileProxySettingsDb } = await import("./database.js");
                        
                        // 1. Create Default Settings Profile
                        const settingsProfile = settingsProfileDb.create(user.id, "Default", true);
                        
                        // 2. Create Default User Profile
                        // Use username or part of email as name
                        const emailName = user.email ? user.email.split('@')[0] : "My Profile";
                        const profileName = (user.username as string) || emailName;
                        
                        const profile = await profileDb.create({
                            user_id: user.id,
                            name: profileName,
                            avatar: profileName, // Default avatar is name (initials)
                            avatar_type: 'initials',
                            avatar_style: 'bottts-neutral', // DiceBear default style
                            is_default: true,
                            settings_profile_id: settingsProfile.id
                        });

                        // 3. Create Profile Proxy Settings (18+ enabled by default as requested: nsfw_filter_enabled = false)
                        profileProxySettingsDb.create({
                            profile_id: profile.id,
                            nsfw_filter_enabled: false, // 18+ allowed
                            nsfw_age_rating: 0, // Unrestricted
                            hide_calendar_button: false,
                            hide_addons_button: false,
                            mobile_click_to_hover: false,
                            hero_banner_enabled: true
                        });
                        
                        // Note: Zentrio addon is auto-enabled by settingsProfileDb.create
                        
                    } catch (e) {
                        console.error("Failed to auto-create profile for new user", e);
                    }
                    console.log("Auto-create profile hook finished for user", user.id);
                }
            }
        }
    }
});