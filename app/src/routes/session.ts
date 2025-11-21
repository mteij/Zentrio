import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { userDb, profileDb, User } from '../services/database'
import { decrypt } from '../services/encryption'
import { sessionMiddleware } from '../middleware/session'

const app = new Hono<{
    Variables: {
        user: User
    }
}>()

app.use('/*', sessionMiddleware)

app.get('/:profileId', async (c) => {
    const user = c.get('user')
    const profileId = parseInt(c.req.param('profileId'), 10)

    const profile = profileDb.findWithSettingsById(profileId)

    if (!profile || profile.user_id !== user.id) {
        return c.html('Profile not found or access denied', 404)
    }

    const hadEncrypted = !!profile.stremio_password
    const decryptedPassword = hadEncrypted ? (decrypt(profile.stremio_password as string) || '') : ''
    const decryptionError = hadEncrypted && !decryptedPassword

    const sessionData = {
        profile: {
            ...profile,
            stremio_password: decryptedPassword,
        },
        user: {
            addonManagerEnabled: user.addonManagerEnabled,
            hideCalendarButton: user.hideCalendarButton,
            hideAddonsButton: user.hideAddonsButton,
            hideCinemetaContent: user.hideCinemetaContent,
            downloadsManagerEnabled: user.downloadsManagerEnabled ?? true,
        },
        // Signal to the client when we failed to decrypt an existing password (likely ENCRYPTION_KEY change)
        decryptionError,
    }

    // This is a simplified way to pass data to a static HTML file.
    // In a real app, you might use a template engine.
    return c.html(html`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Loading Stremio...</title>
            <link rel="apple-touch-icon" sizes="180x180" href="/static/logo/favicon/apple-touch-icon.png">
            <link rel="icon" type="image/png" sizes="32x32" href="/static/logo/favicon/favicon-32x32.png">
            <link rel="icon" type="image/png" sizes="16x16" href="/static/logo/favicon/favicon-16x16.png">
            <link rel="manifest" href="/static/site.webmanifest">
            <link rel="icon" href="/static/logo/favicon/favicon.ico">
            <meta name="theme-color" content="#141414">
            <link rel="stylesheet" href="/static/css/styles.css">
        </head>
        <body style="margin: 0; overflow: hidden; background-color: #141414;">
            <div class="loading-container">
                <div class="pulsing-dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <p class="loading-message" id="loadingMessage">Initializing...</p>
            </div>

            <div id="stremio-container" style="width: 100vw; height: 100vh; display: none;"></div>

            <script>
                window.sessionData = ${raw(JSON.stringify(sessionData))};
            </script>
            <script src="/static/js/mobile-session-handler.js"></script>
            <script src="/static/session-loader.js"></script>
        </body>
        </html>
    `)
})

export default app
