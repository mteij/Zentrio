import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import { twoFactor, magicLink, emailOTP, openAPI, oidcProvider, bearer, phoneNumber } from "better-auth/plugins";
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
    secret: cfg.AUTH_SECRET,
    baseURL: cfg.APP_URL,
    basePath: "/api/auth",
    // Trusted origins for CSRF protection.
    // Only explicitly known origins are trusted — never echo back the request Origin header,
    // as that would allow any website to bypass CSRF checks.
    // Add APP_URL / CLIENT_URL to cover reverse-proxy / custom domain deployments.
    trustedOrigins: [
        "tauri://localhost",
        "zentrio://",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://tauri.localhost",
        "https://tauri.localhost",
        cfg.APP_URL,
        cfg.CLIENT_URL
    ].filter(Boolean) as string[],
    database: db,
    advanced: {
        defaultCookieAttributes: {
            sameSite: cfg.APP_URL?.startsWith("https") ? "none" : "lax",
            secure: cfg.APP_URL?.startsWith("https") ?? false,
        },
        crossSubDomainCookies: {
            enabled: true
        },
        cookiePrefix: "better-auth",
        useSecureCookies: cfg.APP_URL?.startsWith("https") ?? false
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
            // Send verification email for email change flow
            await emailService.sendVerificationEmail(user.email, url);
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
                let magicLinkUrl = url;
                // Check if the callback URL is for Tauri (zentrio://)
                // The url is typically: baseURL + /magic-link/verify?token=...&callbackURL=...
                if (url.includes('callbackURL=zentrio')) {
                    // We want to skip the browser verification and directly open the app
                    // Construct the direct deep link with the token
                    magicLinkUrl = `zentrio://auth/magic-link?token=${token}`;
                }
                await emailService.sendMagicLink(email, magicLinkUrl);
            }
        }),
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                await emailService.sendOTP(email, otp);
            },
        }),
        phoneNumber({
            async sendOTP({ phoneNumber, code }, _ctx) {
                const cfg = getConfig()

                // Production should wire this to a proper SMS provider.
                // As a secure fallback path, we route OTP to a configured admin email inbox.
                if (cfg.ADMIN_PHONE_OTP_DEV_FALLBACK_EMAIL) {
                    await emailService.sendOTP(cfg.ADMIN_PHONE_OTP_DEV_FALLBACK_EMAIL, `${code} (phone: ${phoneNumber})`)
                    return
                }

                // Never silently succeed in production without a delivery channel.
                if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
                    throw new Error('Phone OTP provider not configured')
                }

                // Development-only fallback for local testing.
                console.warn(`[PhoneOTP] ${phoneNumber} -> ${code}`)
            },
            requireVerification: false
        }),
        openAPI(),
        oidcProvider({
            loginPage: "/login",
        }),
        bearer()
    ],
    user: {
        changeEmail: {
            enabled: true,
        },
        deleteUser: {
            enabled: true,
        },
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "user",
            },
            banned: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
            banReason: {
                type: "string",
                required: false,
            },
            banExpires: {
                type: "date",
                required: false,
            },
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
        session: {
            create: {
                before: async (session) => {
                    if (!cfg.ADMIN_BOOTSTRAP_ALLOWED_EMAILS.length) return { data: session }

                    const user = db.prepare('SELECT id, email, role FROM user WHERE id = ?').get((session as any).userId) as any
                    if (!user || user.role === 'admin') return { data: session }

                    const email = String(user.email || '').toLowerCase()
                    if (cfg.ADMIN_BOOTSTRAP_ALLOWED_EMAILS.includes(email)) {
                        db.prepare("UPDATE user SET role = 'admin', updatedAt = ? WHERE id = ?")
                            .run(new Date().toISOString(), user.id)
                        console.log(`[Bootstrap] Auto-elevated ${email} to admin on login`)
                    }

                    return { data: session }
                }
            }
        },
        user: {
            create: {
                before: async (user) => {
                    if (user.email) {
                        user.email = user.email.toLowerCase();
                    }

                    if (!user.username && user.name) {
                        // Use name as username if not explicitly provided
                        user.username = user.name;
                    } else if (!user.username && user.email) {
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
