import { Hono } from 'hono'
import { z } from 'zod'
import { auth } from '../../services/auth'
import { userDb } from '../../services/database'
import { validate, schemas } from '../../utils/api'
import { getConfig } from '../../services/envParser'
import { randomBytes } from 'crypto'

const app = new Hono()

// ============================================================================
// Secure Authorization Code Store
// Short-lived codes for secure deep link token exchange (30 second expiry)
// ============================================================================
const authCodeStore = new Map<string, { sessionToken: string; expiresAt: number }>()

// Clean up expired codes every minute
setInterval(() => {
    const now = Date.now()
    for (const [code, data] of authCodeStore.entries()) {
        if (now > data.expiresAt) {
            authCodeStore.delete(code)
        }
    }
}, 60 * 1000)

/**
 * Generate a secure, single-use authorization code
 */
function generateAuthCode(sessionToken: string): string {
    const code = randomBytes(32).toString('hex')
    authCodeStore.set(code, {
        sessionToken,
        expiresAt: Date.now() + 30 * 1000 // 30 seconds
    })
    return code
}

/**
 * Exchange an authorization code for a session token (single-use)
 */
function exchangeAuthCode(code: string): string | null {
    const data = authCodeStore.get(code)
    if (!data) return null
    if (Date.now() > data.expiresAt) {
        authCodeStore.delete(code)
        return null
    }
    // Single-use: delete after exchange
    authCodeStore.delete(code)
    return data.sessionToken
}

// ============================================================================
// Link Code Store (for Tauri account linking)
// Short-lived codes that allow browser to establish session for OAuth linking
// ============================================================================
const linkCodeStore = new Map<string, { sessionToken: string; expiresAt: number }>()

// Clean up expired link codes every minute
setInterval(() => {
    const now = Date.now()
    for (const [code, data] of linkCodeStore.entries()) {
        if (now > data.expiresAt) {
            linkCodeStore.delete(code)
        }
    }
}, 60 * 1000)

/**
 * Generate a link code for account linking from Tauri
 */
function generateLinkCode(sessionToken: string): string {
    const code = randomBytes(32).toString('hex')
    linkCodeStore.set(code, {
        sessionToken,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes (longer than auth code since user needs to complete OAuth)
    })
    return code
}

/**
 * Exchange a link code for a session token (single-use)
 */
function exchangeLinkCode(code: string): string | null {
    const data = linkCodeStore.get(code)
    if (!data) return null
    if (Date.now() > data.expiresAt) {
        linkCodeStore.delete(code)
        return null
    }
    // Single-use: delete after exchange
    linkCodeStore.delete(code)
    return data.sessionToken
}

/**
 * Generate particle background CSS and JS for SSO pages
 * Matches the ParticleBackground React component
 */
function getParticleBackgroundHtml(): string {
    return `
        <canvas id="particles" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;"></canvas>
        <script>
            (function() {
                const canvas = document.getElementById('particles');
                const ctx = canvas.getContext('2d');
                let particles = [];
                const color = [220, 38, 38];
                
                function resize() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }
                
                function seededRandom(seed) {
                    let value = seed;
                    return function() {
                        value = (value * 9301 + 49297) % 233280;
                        return value / 233280;
                    };
                }
                
                function createParticles() {
                    const random = seededRandom(12345);
                    const count = Math.floor((window.innerWidth * window.innerHeight) / 15000);
                    for (let i = 0; i < count; i++) {
                        particles.push({
                            x: random() * window.innerWidth,
                            y: random() * window.innerHeight,
                            vx: (random() - 0.5) * 0.3,
                            vy: (random() - 0.5) * 0.3,
                            size: random() * 2 + 0.5,
                            opacity: random() * 0.4 + 0.1
                        });
                    }
                }
                
                function animate() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    particles.forEach(function(p) {
                        p.x += p.vx;
                        p.y += p.vy;
                        if (p.x < 0) p.x = canvas.width;
                        if (p.x > canvas.width) p.x = 0;
                        if (p.y < 0) p.y = canvas.height;
                        if (p.y > canvas.height) p.y = 0;
                        
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + p.opacity + ')';
                        ctx.fill();
                    });
                    
                    // Draw connections
                    let connections = 0;
                    for (let i = 0; i < particles.length && connections < 50; i++) {
                        const p1 = particles[i];
                        for (let j = i + 1; j < particles.length && connections < 50; j++) {
                            const p2 = particles[j];
                            const dx = p1.x - p2.x;
                            const dy = p1.y - p2.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 100) {
                                ctx.beginPath();
                                ctx.moveTo(p1.x, p1.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (0.08 * (1 - dist / 100)) + ')';
                                ctx.stroke();
                                connections++;
                            }
                        }
                    }
                    
                    requestAnimationFrame(animate);
                }
                
                resize();
                createParticles();
                animate();
                window.addEventListener('resize', resize);
            })();
        </script>
    `;
}

// ============================================================================
// Public Endpoints
// ============================================================================

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

// ============================================================================
// Native App Authentication Flow
// ============================================================================

// [POST /mobile-callback] Handle mobile/desktop deep link callback
// Exchanges authorization code for session token securely
app.post('/mobile-callback', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { url, authCode } = body

    if (!url && !authCode) {
        return c.json({ error: 'URL or Authorization Code is required' }, 400)
    }

    // Secure Authorization Code Exchange Path
    if (authCode) {
        const sessionToken = exchangeAuthCode(authCode)
        
        if (!sessionToken) {
            return c.json({ error: 'Invalid or expired authorization code' }, 401)
        }
        
        // Validate the session token is actually valid before setting cookie
        try {
            const mockRequest = new Request('http://localhost/api/auth/get-session', {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            })
            const session = await auth.api.getSession({ headers: mockRequest.headers })
            
            if (!session || !session.user) {
                return c.json({ error: 'Invalid session token' }, 401)
            }
            
            // Token is valid - set the cookie
            const cfg = getConfig()
            // Only use Secure cookies if APP_URL is https AND we are not in development/test
            // This prevents cookie rejection on Android localhost
            const isSecure = (cfg.APP_URL?.startsWith('https') ?? true) && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'
            const cookieName = "better-auth.session_token"
            const cookieValue = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`
            
            c.header('Set-Cookie', cookieValue)
            
            return c.json({ 
                success: true,
                user: session.user,
                token: sessionToken
            })
        } catch (e: any) {
            return c.json({ error: 'Session validation failed' }, 401)
        }
    }

    // Legacy URL parsing path (kept for backwards compatibility)
    try {
        const deepLinkUrl = new URL(url)
        const code = deepLinkUrl.searchParams.get('code')
        const state = deepLinkUrl.searchParams.get('state')
        const error = deepLinkUrl.searchParams.get('error')
        const authCodeParam = deepLinkUrl.searchParams.get('auth_code')

        if (error) {
            return c.json({ error }, 400)
        }
        
        // Handle new auth_code parameter from deep link
        if (authCodeParam) {
            const sessionToken = exchangeAuthCode(authCodeParam)
            if (!sessionToken) {
                return c.json({ error: 'Invalid or expired authorization code' }, 401)
            }
            
            // Validate session
            const mockRequest = new Request('http://localhost/api/auth/get-session', {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            })
            const session = await auth.api.getSession({ headers: mockRequest.headers })
            
            if (!session || !session.user) {
                return c.json({ error: 'Invalid session token' }, 401)
            }
            
            const cfg = getConfig()
            const isSecure = (cfg.APP_URL?.startsWith('https') ?? true) && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'
            const cookieName = "better-auth.session_token"
            const cookieValue = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`
            
            c.header('Set-Cookie', cookieValue)
            
            return c.json({ 
                success: true,
                user: session.user,
                token: sessionToken
            })
        }

        if (!code || !state) {
            return c.json({ error: 'Missing code or state' }, 400)
        }

        // OAuth code exchange via Better Auth
        const mockUrl = new URL('/api/auth/callback/social', 'http://localhost:3000')
        mockUrl.searchParams.set('code', code)
        mockUrl.searchParams.set('state', state)
        
        const mockRequest = new Request(mockUrl.toString(), {
            method: 'GET',
            headers: c.req.raw.headers
        })

        const response = await auth.handler(mockRequest)
        
        if (response.ok) {
            const sessionData = await response.json()
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
        return c.json({ error: e.message || 'Internal server error' }, 500)
    }
})

// [GET /login-proxy] Initiate social login flow for native apps
app.get('/login-proxy', async (c) => {
    const provider = c.req.query('provider')
    const callbackURL = c.req.query('callbackURL')
    
    if (!provider || !callbackURL) {
        return c.text('Missing provider or callbackURL', 400)
    }
    
    return c.html(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Connecting... - Zentrio</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%);
                        color: #fff;
                        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: 24px;
                    }
                    .container {
                        position: relative;
                        z-index: 10;
                        text-align: center;
                    }
                    .loader {
                        border: 3px solid rgba(255,255,255,0.1);
                        border-top: 3px solid #e50914;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    p {
                        color: rgba(255, 255, 255, 0.8);
                        font-size: 18px;
                    }
                    .error {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 16px;
                        padding: 32px;
                        max-width: 400px;
                    }
                    .error h3 {
                        color: #ef4444;
                        margin-bottom: 12px;
                    }
                    .error p {
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 16px;
                    }
                    .retry-btn {
                        background: linear-gradient(135deg, #e50914, #b91c1c);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    }
                    .retry-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 30px -5px rgba(229, 9, 20, 0.4);
                    }
                </style>
            </head>
            <body>
                ${getParticleBackgroundHtml()}
                <div class="container">
                    <div class="loader"></div>
                    <p>Connecting to ${provider}...</p>
                </div>
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
                            document.querySelector('.container').innerHTML = \`
                                <div class="error">
                                    <h3>Authentication Error</h3>
                                    <p>\${data.message || data.error || 'Unknown error occurred'}</p>
                                    <button class="retry-btn" onclick="window.history.back()">Go Back</button>
                                </div>
                            \`;
                        }
                    })
                    .catch(err => {
                        document.querySelector('.container').innerHTML = \`
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

// [POST /link-code] Generate a link code for Tauri apps to use when linking accounts
// This allows the browser to establish a session from the app's authentication
app.post('/link-code', async (c) => {
    // Get session from Authorization header (Tauri passes Bearer token)
    const authHeader = c.req.header('Authorization')
    let session = null
    
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        try {
            const mockRequest = new Request('http://localhost/api/auth/get-session', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            session = await auth.api.getSession({ headers: mockRequest.headers })
            
            if (session && session.session) {
                // Generate a link code that can be used in the browser
                const linkCode = generateLinkCode(session.session.token)
                return c.json({ linkCode })
            }
        } catch (e) {
            console.error('Failed to validate session for link code:', e)
        }
    }
    
    // Also try session cookie (fallback)
    if (!session) {
        session = await auth.api.getSession({
            headers: c.req.raw.headers
        })
        
        if (session && session.session) {
            const linkCode = generateLinkCode(session.session.token)
            return c.json({ linkCode })
        }
    }
    
    return c.json({ error: 'Not authenticated' }, 401)
})

// [GET /link-proxy] Initiate social account linking flow for native apps
// Unlike login-proxy, this links an SSO provider to an existing authenticated account
// Accepts either session cookie (web) or linkCode parameter (Tauri)
app.get('/link-proxy', async (c) => {
    const provider = c.req.query('provider')
    const callbackURL = c.req.query('callbackURL')
    const linkCode = c.req.query('linkCode')
    
    if (!provider || !callbackURL) {
        return c.text('Missing provider or callbackURL', 400)
    }
    
    let session = null
    let sessionToken: string | null = null
    
    // First try linkCode (from Tauri app)
    if (linkCode) {
        sessionToken = exchangeLinkCode(linkCode)
        if (sessionToken) {
            // Validate the session token
            try {
                const mockRequest = new Request('http://localhost/api/auth/get-session', {
                    headers: { 'Authorization': `Bearer ${sessionToken}` }
                })
                session = await auth.api.getSession({ headers: mockRequest.headers })
                
                if (session && session.user) {
                    // Set the session cookie so the OAuth flow works
                    const cfg = getConfig()
                    const isSecure = cfg.APP_URL?.startsWith('https') ?? true
                    const cookieName = "better-auth.session_token"
                    const cookieValue = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`
                    c.header('Set-Cookie', cookieValue)
                }
            } catch (e) {
                console.error('Link code session validation failed:', e)
            }
        }
    }
    
    // Fall back to session cookie (web flow)
    if (!session || !session.user) {
        session = await auth.api.getSession({
            headers: c.req.raw.headers
        });
    }
    
    if (!session || !session.user) {
        return c.text('You must be signed in to link accounts. Please sign in first and try again.', 401)
    }
    
    return c.html(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Linking Account... - Zentrio</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%);
                        color: #fff;
                        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: 24px;
                    }
                    .container {
                        position: relative;
                        z-index: 10;
                        text-align: center;
                    }
                    .loader {
                        border: 3px solid rgba(255,255,255,0.1);
                        border-top: 3px solid #e50914;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    p { color: rgba(255, 255, 255, 0.8); font-size: 18px; }
                    .error {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 16px;
                        padding: 32px;
                        max-width: 400px;
                    }
                    .error h3 { color: #ef4444; margin-bottom: 12px; }
                    .error p { color: rgba(255, 255, 255, 0.7); margin-bottom: 16px; }
                    .retry-btn {
                        background: linear-gradient(135deg, #e50914, #b91c1c);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    }
                    .retry-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 30px -5px rgba(229, 9, 20, 0.4);
                    }
                </style>
            </head>
            <body>
                ${getParticleBackgroundHtml()}
                <div class="container">
                    <div class="loader"></div>
                    <p>Linking ${provider}...</p>
                </div>
                <script>
                    fetch('/api/auth/link-social/${provider}', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            callbackURL: '${callbackURL}'
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.url) {
                            window.location.href = data.url;
                        } else {
                            document.querySelector('.container').innerHTML = \`
                                <div class="error">
                                    <h3>Linking Error</h3>
                                    <p>\${data.message || data.error || 'Unknown error occurred'}</p>
                                    <button class="retry-btn" onclick="window.close()">Close</button>
                                </div>
                            \`;
                        }
                    })
                    .catch(err => {
                        document.querySelector('.container').innerHTML = \`
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


// [GET /native-redirect] Handle session handoff to native deep link
// Uses secure authorization code instead of exposing session token
app.get('/native-redirect', async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers
    });

    if (!session || !session.session) {
        return c.text('Not authenticated', 401);
    }

    // Generate a short-lived, single-use authorization code
    const authCode = generateAuthCode(session.session.token);
    
    // Show success page with auto-redirect to app
    const deepLink = `zentrio://auth/callback?auth_code=${authCode}`;
    
    return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Successful - Zentrio</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%);
                    color: #fff;
                    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    text-align: center;
                }
                .container {
                    position: relative;
                    z-index: 10;
                    max-width: 400px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 48px 32px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .logo {
                    font-size: 48px;
                    margin-bottom: 24px;
                }
                .checkmark {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    box-shadow: 0 10px 30px -5px rgba(34, 197, 94, 0.4);
                }
                .checkmark svg {
                    width: 40px;
                    height: 40px;
                    color: white;
                }
                h1 {
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 12px;
                    background: linear-gradient(to right, #fff, #e0e0e0);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                p {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 16px;
                    line-height: 1.6;
                    margin-bottom: 24px;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #e50914, #b91c1c);
                    color: white;
                    text-decoration: none;
                    padding: 14px 32px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px -5px rgba(229, 9, 20, 0.4);
                }
                .hint {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 13px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            ${getParticleBackgroundHtml()}
            <div class="container">
                <div class="checkmark">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1>You're signed in!</h1>
                <p>Authentication successful. You can now return to Zentrio.</p>
                <a href="${deepLink}" class="btn" id="openApp">Open Zentrio</a>
                <p class="hint">You can close this tab</p>
            </div>
            <script>
                // Auto-open the app
                setTimeout(function() {
                    window.location.href = "${deepLink}";
                }, 500);
            </script>
        </body>
        </html>
    `);
});

// ============================================================================
// Better Auth Passthrough
// ============================================================================

app.all("*", (c) => {
    const cfg = getConfig();
    if (cfg.APP_URL) {
        try {
            const reqUrl = new URL(c.req.raw.url);
            const appUrl = new URL(cfg.APP_URL);
            
            if (reqUrl.protocol !== appUrl.protocol || reqUrl.host !== appUrl.host) {
                const newUrl = new URL(c.req.raw.url);
                newUrl.protocol = appUrl.protocol;
                newUrl.host = appUrl.host;
                newUrl.port = appUrl.port;
                
                const newReq = new Request(newUrl.toString(), c.req.raw);
                return auth.handler(newReq);
            }
        } catch (e) {
            // Fall back to original request
        }
    }
    return auth.handler(c.req.raw);
});

export default app