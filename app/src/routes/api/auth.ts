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

// [GET /error] Handle auth errors and redirect to settings with error param
app.get('/error', (c) => {
    const error = c.req.query('error') || 'unknown_error'
    const cfg = getConfig()
    // Redirect to settings page with error in query params
    return c.redirect(`${cfg.CLIENT_URL}/settings?error=${encodeURIComponent(error)}`)
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

        // Create a mock request to Better Auth's callback handler
        const mockUrl = new URL('/api/auth/callback/social', 'http://localhost:3000')
        mockUrl.searchParams.set('code', code)
        mockUrl.searchParams.set('state', state)
        
        // Create a mock request object
        const mockRequest = new Request(mockUrl.toString(), {
            method: 'GET',
            headers: c.req.raw.headers
        })

        // Let Better Auth handle the callback
        const response = await auth.handler(mockRequest)
        
        if (response.ok) {
            // Extract session data from the response
            const sessionData = await response.json()
            
            // Return the session data to the client
            return c.json({
                success: true,
                user: sessionData.user,
                session: sessionData.session
            })
        } else {
            const errorData = await response.json().catch(() => ({}))
            return c.json({
                error: errorData.error || 'Authentication failed',
                message: errorData.message || 'Could not complete authentication'
            }, response.status as any)
        }
    } catch (e: any) {
        console.error('Mobile callback error:', e)
        return c.json({ error: e.message || 'Internal server error' }, 500)
    }
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
                    .error {
                        color: #ef4444;
                        text-align: center;
                        max-width: 400px;
                        padding: 20px;
                    }
                    .retry-btn {
                        background-color: #e50914;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 10px;
                    }
                    .retry-btn:hover {
                        background-color: #f40612;
                    }
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
                            document.body.innerHTML = \`
                                <div class="error">
                                    <h3>Authentication Error</h3>
                                    <p>\${data.message || data.error || 'Unknown error occurred'}</p>
                                    <button class="retry-btn" onclick="window.history.back()">Go Back</button>
                                </div>
                            \`;
                        }
                    })
                    .catch(err => {
                        document.body.innerHTML = \`
                            <div class="error">
                                <h3>Connection Error</h3>
                                <p>Failed to connect to authentication service</p>
                                <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
                            </div>
                        \`;
                    });
                </script>
            </body>
        </html>
    `)
})

// [POST /deep-link-callback] Handle deep link authentication for native apps
app.post('/deep-link-callback', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { provider, code, state, callbackURL } = body

    if (!provider || !code || !state) {
        return c.json({ error: 'Missing required parameters' }, 400)
    }

    try {
        // Create a mock request to Better Auth's callback handler
        const mockUrl = new URL(`/api/auth/callback/${provider}`, 'http://localhost:3000')
        mockUrl.searchParams.set('code', code)
        mockUrl.searchParams.set('state', state)
        
        // Create a mock request object with the callback URL
        const mockRequest = new Request(mockUrl.toString(), {
            method: 'GET',
            headers: {
                ...Object.fromEntries(c.req.raw.headers.entries()),
                'Cookie': c.req.raw.headers.get('Cookie') || ''
            }
        })

        // Let Better Auth handle the callback
        const response = await auth.handler(mockRequest)
        
        if (response.ok) {
            // Get the session cookies from the response
            const setCookieHeader = response.headers.get('set-cookie')
            
            // Extract session data
            const sessionData = await response.json()
            
            return c.json({
                success: true,
                user: sessionData.user,
                session: sessionData.session,
                cookies: setCookieHeader
            })
        } else {
            const errorData = await response.json().catch(() => ({}))
            return c.json({
                error: errorData.error || 'Authentication failed',
                message: errorData.message || 'Could not complete authentication'
            }, response.status as any)
        }
    } catch (e: any) {
        console.error('Deep link callback error:', e)
        return c.json({ error: e.message || 'Internal server error' }, 500)
    }
})

// Delegate everything else to Better Auth
app.all("*", (c) => {
    return auth.handler(c.req.raw);
});

export default app