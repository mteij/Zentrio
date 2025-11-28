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

// Delegate everything else to Better Auth
app.all("*", (c) => {
    console.log(`[Auth] Handling request: ${c.req.method} ${c.req.url}`);
    console.log(`[Auth] Path: ${c.req.path}`);
    console.log(`[Auth] Origin: ${c.req.header('Origin')}`);
    console.log(`[Auth] Referer: ${c.req.header('Referer')}`);
    return auth.handler(c.req.raw);
});

export default app