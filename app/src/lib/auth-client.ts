import { createAuthClient } from "better-auth/client";
import { twoFactorClient, magicLinkClient, emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
    plugins: [
        twoFactorClient({
            onTwoFactorRedirect: () => {
                window.location.href = "/two-factor";
            }
        }),
        magicLinkClient(),
        emailOTPClient()
    ]
});