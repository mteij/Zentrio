import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import { twoFactor, magicLink, emailOTP } from "better-auth/plugins";
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
    database: db,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async sendResetPassword({ user, url, token }: any, request: any) {
            await emailService.sendResetPasswordEmail(user.email, url);
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        async sendVerificationEmail({ user, url, token }: any, request: any) {
            await emailService.sendVerificationEmail(user.email, url);
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
        })
    ],
    user: {
        changeEmail: {
            enabled: true,
        },
        additionalFields: {
            username: {
                type: "string",
                required: true,
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
            downloadsManagerEnabled: {
                type: "boolean",
                defaultValue: true,
            },
        }
    }
});