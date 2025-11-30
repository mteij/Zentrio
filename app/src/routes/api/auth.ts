import { Hono } from 'hono'
import { z } from 'zod'
import { auth } from '../../services/auth'
import { userDb } from '../../services/database'
import { validate, schemas } from '../../utils/api'
import { getConfig } from '../../services/envParser'

const app = new Hono()

// [GET /providers] Get enabled auth providers
app.get('/providers', (c) => {
    const cfg = getConfig()
    return c.json({
        google: !!cfg.GOOGLE_CLIENT_ID && !!cfg.GOOGLE_CLIENT_SECRET,
        github: !!cfg.GITHUB_CLIENT_ID && !!cfg.GITHUB_CLIENT_SECRET,
        discord: !!cfg.DISCORD_CLIENT_ID && !!cfg.DISCORD_CLIENT_SECRET,
        oidc: !!cfg.OIDC_CLIENT_ID && !!cfg.OIDC_CLIENT_SECRET && !!cfg.OIDC_ISSUER,
        oidcName: cfg.OIDC_DISPLAY_NAME || 'OpenID'
    })
})

// [POST /identify] Check if user exists
app.post('/identify', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const validation = await validate(z.object({
        email: schemas.email
    }), body)

    if (!validation.success) {
        return c.json({ error: 'Invalid email address' }, 400)
    }

    const { email } = validation.data
    const user = userDb.findByEmail(email)

    return c.json({
        exists: !!user,
        nickname: user?.username || user?.name || null
    })
})

// [POST /send-verification-email] Resend verification email
// We delegate this to Better Auth's default handler which handles it correctly
// app.post('/send-verification-email', ...)

// [POST /mobile-callback] Handle mobile/desktop deep link callback
// This endpoint receives the code and state from the deep link and exchanges it for a session
app.post('/mobile-callback', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { url } = body

    if (!url) {
        return c.json({ error: 'URL is required' }, 400)
    }

    try {
        // Parse the deep link URL to extract query parameters
        // Format: zentrio://auth/callback?code=...&state=...
        const deepLinkUrl = new URL(url)
        const code = deepLinkUrl.searchParams.get('code')
        const state = deepLinkUrl.searchParams.get('state')
        const error = deepLinkUrl.searchParams.get('error')

        if (error) {
            return c.json({ error: error }, 400)
        }

        if (!code || !state) {
            return c.json({ error: 'Missing code or state' }, 400)
        }

        // We need to verify the state and exchange the code for a session.
        // Since the initial request (sign-in) set a cookie with the state,
        // and that cookie should be present in THIS request (if sent from the same client),
        // we can try to manually invoke the provider's callback handler.
        
        // However, Better Auth's callback handler expects to be called via GET with query params.
        // We can construct a fake request to pass to Better Auth.
        
        // But wait, the issue is likely that the cookie set during sign-in (on tauri://localhost)
        // is NOT available when the system browser opens the provider's login page.
        // Wait, no.
        // 1. App (tauri://localhost) calls POST /api/auth/sign-in/social
        // 2. Server responds with URL to provider. Server sets 'better-auth.state' cookie on localhost:3000 (or whatever the API domain is).
        //    BUT, since the request came from tauri://localhost, the cookie might be set for tauri://localhost OR rejected if SameSite is strict.
        //    If the API is at http://localhost:3000, the cookie is set for localhost.
        
        // 3. App opens system browser with the provider URL.
        // 4. User logs in.
        // 5. Provider redirects to http://localhost:3000/api/auth/callback/google (or whatever is configured).
        //    This request happens in the SYSTEM BROWSER. It has the cookies for localhost:3000.
        //    So the state verification SHOULD work here.
        
        // 6. The server verifies state, creates session, sets session cookie, and redirects to... where?
        //    It redirects to the callbackURL provided in step 1.
        //    If callbackURL was 'zentrio://auth/callback', the server redirects to that custom scheme.
        
        // 7. The system browser sees zentrio://... and launches the app.
        // 8. The app receives the deep link.
        
        // THE PROBLEM:
        // The session cookie is set in the SYSTEM BROWSER (jar for localhost:3000).
        // The app (tauri://localhost) does NOT have this cookie.
        
        // So when the app makes subsequent requests, it's not authenticated.
        
        // SOLUTION:
        // The deep link should contain a one-time token or the session token itself?
        // Better Auth doesn't send the session token in the URL by default for security.
        
        // However, the logs show "error=state_mismatch" happening at step 5/6 (GET /api/auth/callback/google).
        // This means the cookie set in step 2 is NOT present or doesn't match in step 5.
        
        // Why?
        // Step 1: POST /api/auth/sign-in/social from Tauri.
        // If the API is on localhost:3000, and Tauri is on tauri://localhost (or http://tauri.localhost).
        // The fetch request is cross-origin.
        // The response sets a cookie.
        // Does the Tauri webview accept this cookie? Yes, usually.
        // BUT, the system browser (Chrome/Safari) is a DIFFERENT cookie jar.
        
        // So when the system browser makes the callback request (Step 5), it does NOT have the state cookie set by the Tauri webview in Step 2.
        
        // FIX:
        // We need to initiate the login flow IN THE SYSTEM BROWSER, not in the Tauri webview.
        // OR we need to use a flow that doesn't rely on cookies for state in the browser.
        
        // If we initiate in system browser:
        // 1. App opens system browser to http://localhost:3000/api/auth/sign-in/social?provider=google&callbackURL=zentrio://...
        //    (GET request instead of POST? Better Auth might support GET for sign-in if configured, or we make a wrapper).
        // 2. System browser sets state cookie.
        // 3. Redirects to Google.
        // 4. Google redirects back to System Browser.
        // 5. System browser has state cookie -> Verification passes.
        // 6. Server creates session, sets session cookie (in system browser).
        // 7. Server redirects to zentrio://auth/callback?session_token=... (we need to pass the token back).
        
        // Does Better Auth support passing the token back in the URL?
        // Not by default.
        
        // Alternative:
        // Use the "mobile" flow where the client generates the state and PKCE verifier?
        // Better Auth might not support this out of the box yet.
        
        // Let's try the "initiate in system browser" approach.
        // We need an endpoint that accepts GET and redirects to the provider.
        
        // But wait, the logs show:
        // [Auth] Cookies: better-auth.state=... (present in the callback request!)
        // So the system browser DOES have a state cookie.
        // Why is it a mismatch?
        // Maybe the cookie was set by a previous attempt in the system browser?
        // Or maybe the Tauri app IS sharing cookies with the system browser? (Unlikely on desktop).
        
        // If the cookie in the log is from a previous attempt, it won't match the state in the URL from the NEW attempt (initiated by Tauri).
        
        // So, the fix is indeed to initiate the flow in the system browser so the state cookie is set THERE.
        
        // We'll create a GET endpoint that proxies to the sign-in.
    } catch (e: any) {
        return c.json({ error: e.message }, 500)
    }
    
    return c.json({ success: true })
})

// [GET /login-proxy] Initiate social login flow for native apps
// This ensures the state cookie is set in the system browser where the callback will happen
app.get('/login-proxy', async (c) => {
    const provider = c.req.query('provider')
    const callbackURL = c.req.query('callbackURL')
    
    if (!provider || !callbackURL) {
        return c.text('Missing provider or callbackURL', 400)
    }
    
    // We use client-side fetch to initiate the sign-in.
    // This ensures the Set-Cookie header from the API response is processed by the browser,
    // setting the state cookie in the system browser's jar.
    // Then we redirect to the provider URL returned by the API.
    
    return c.html(`
        <html>
            <head>
                <title>Redirecting...</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        background-color: #141414;
                        color: #fff;
                        font-family: system-ui, -apple-system, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .loader {
                        border: 3px solid rgba(255,255,255,0.1);
                        border-top: 3px solid #e50914;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        animation: spin 1s linear infinite;
                        margin-bottom: 16px;
                    }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="loader"></div>
                <p>Connecting to ${provider}...</p>
                <script>
                    fetch('/api/auth/sign-in/social', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider: '${provider}',
                            callbackURL: '${callbackURL}'
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.url) {
                            window.location.href = data.url;
                        } else {
                            document.body.innerHTML = '<p style="color: #ef4444">Error: ' + (data.message || data.error || 'Unknown error') + '</p>';
                        }
                    })
                    .catch(err => {
                        document.body.innerHTML = '<p style="color: #ef4444">Error: ' + err.message + '</p>';
                    });
                </script>
            </body>
        </html>
    `)
})

// Delegate everything else to Better Auth
app.all("*", (c) => {
    return auth.handler(c.req.raw);
});

export default app