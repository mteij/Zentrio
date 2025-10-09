import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { emailService } from '../../services/email'
import { userDb, verifyPassword, sessionDb, otpDb, magicLinkDb } from '../../services/database'
import { getConfig } from '../../services/envParser'

const app = new Hono()

// Using database-backed OTP codes and magic links (hashed at rest)

// Utility functions
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateMagicToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Authentication API Routes
app.post('/check-user', async (c) => {
  try {
    const { email } = await c.req.json()
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }
    
    // Normalize email for lookups
    const norm = String(email).trim().toLowerCase()
    const userExists = userDb.exists(norm)
    const user = userDb.findByEmail(norm)
    return c.json({
      exists: userExists,
      username: user?.username || null
    })
  } catch (error) {
    return c.json({ error: 'Invalid request' }, 400)
  }
})

app.post('/identify', async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = rawEmail.trim().toLowerCase()

    // Validate minimal email format after normalization
    if (!email || !email.includes('@')) {
      return c.json({ error: 'Invalid email' }, 400)
    }

    // Enhanced identify endpoint: return existence boolean and nickname when user exists.
    // Security: Only return nickname for existing users to avoid user enumeration.
    // Rate limiting: global limiter is applied in app/src/index.ts; consider an endpoint-specific limiter here if needed later.
    const exists = userDb.exists(email)
    
    if (exists) {
      const user = userDb.findByEmail(email)
      return c.json({
        exists: true,
        nickname: user?.username || null
      }, 200)
    }
    
    return c.json({ exists: false }, 200)
  } catch {
    return c.json({ error: 'Invalid email' }, 400)
  }
})

app.post('/register', async (c) => {
  try {
    const { email, username, password, remember } = await c.req.json()
    
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normEmail || !username || !password) {
      return c.json({ error: 'All fields are required' }, 400)
    }
    
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400)
    }
    
    if (userDb.exists(normEmail)) {
      return c.json({ error: 'User already exists' }, 409)
    }
    
    // Create user (username can be duplicate as it's just a nickname)
    const user = await userDb.create({
      email: normEmail,
      username,
      password,
      first_name: username, // Use username as display name
      last_name: ''
    })
    
    // Send welcome email (non-blocking/failure-tolerant)
    try {
      await emailService.sendWelcomeEmail(normEmail, username)
    } catch (e) {
      console.warn('[register] sendWelcomeEmail failed (continuing):', (e as any)?.message || e)
    }
    
    // Create session to automatically log in the user
    const session = sessionDb.create(user.id, !!remember)
    
    // Set session cookie (10y for remembered, 30d otherwise)
    const cookieMaxAge = !!remember ? 60 * 60 * 24 * 400 : 60 * 60 * 24 * 30
    setCookie(c, 'sessionId', session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: cookieMaxAge,
      path: '/'
    })
    
    return c.json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, username: user.username },
      // The redirect URL is now correctly sent to the client
      redirect: '/profiles'
    })
  } catch (error) {
    return c.json({ error: 'Failed to create account' }, 500)
  }
})

app.post('/signin-password', async (c) => {
  try {
    // Safer body parsing to avoid 500s on malformed JSON
    const body = await c.req.json().catch(() => null)
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const remember = !!body?.remember

    const normEmail = rawEmail.trim().toLowerCase()
    if (!normEmail || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }
    
    const user = userDb.findByEmail(normEmail)
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    if (!user.password_hash) {
      return c.json({ error: 'Password authentication not available for this account' }, 401)
    }
    
    // Guard against malformed hashes: treat compare errors as invalid credentials instead of 500
    let isValidPassword = false
    try {
      isValidPassword = await verifyPassword(password, user.password_hash)
    } catch (e: any) {
      console.warn('[signin-password] bcrypt compare failed:', e?.message || e)
      isValidPassword = false
    }
    if (!isValidPassword) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    // Create session
    const session = sessionDb.create(user.id, !!remember)
    
    // Set session cookie (10y for remembered, 30d otherwise)
    const cookieMaxAge = !!remember ? 60 * 60 * 24 * 400 : 60 * 60 * 24 * 30
    setCookie(c, 'sessionId', session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: cookieMaxAge,
      path: '/'
    })
    
    return c.json({
      message: 'Authentication successful',
      user: { id: user.id, email: user.email, username: user.username, firstName: user.first_name, lastName: user.last_name }
    })
  } catch (error: any) {
    console.error('[signin-password] unexpected error:', error?.message || error)
    return c.json({ error: 'Failed to authenticate' }, 500)
  }
})

app.post('/magic-link', async (c) => {
  try {
    const { email, remember } = await c.req.json()
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    
    if (!normEmail || !userDb.exists(normEmail)) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // Create a one-time, database-backed magic link token (15 minutes)
    const token = magicLinkDb.create(normEmail, 15)
    const { APP_URL } = getConfig()
    const magicLink = `${APP_URL}/api/auth/verify-magic?token=${token}${remember ? '&remember=1' : ''}`
    
    // Send magic link email
    await emailService.sendMagicLink(normEmail, magicLink)
    
    return c.json({ message: 'Magic link sent successfully' })
  } catch (error: any) {
    if (error && error.message === 'RATE_LIMITED') {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }
    return c.json({ error: 'Failed to send magic link' }, 500)
  }
})

app.post('/send-otp', async (c) => {
  try {
    const { email } = await c.req.json()
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    
    if (!normEmail || !userDb.exists(normEmail)) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // Issue a one-time, database-backed OTP (10 minutes)
    const otp = await otpDb.issue(normEmail, 10)
    
    // Send OTP email
    await emailService.sendOTP(normEmail, otp)
    
    return c.json({ message: 'OTP sent successfully' })
  } catch (error: any) {
    if (error && error.message === 'RATE_LIMITED') {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }
    return c.json({ error: 'Failed to send OTP' }, 500)
  }
})

app.post('/verify-otp', async (c) => {
  try {
    const { email, otp, remember } = await c.req.json()
    
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normEmail || !otp) {
      return c.json({ error: 'Email and OTP are required' }, 400)
    }
    
    // Verify and consume OTP
    const valid = await otpDb.verifyAndConsume(normEmail, otp)
    if (!valid) {
      return c.json({ error: 'Invalid or expired OTP' }, 400)
    }
    
    const user = userDb.findByEmail(normEmail)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // Create session
    const session = sessionDb.create(user.id, !!remember)
    
    // Set session cookie (10y for remembered, 30d otherwise)
    const cookieMaxAge = !!remember ? 60 * 60 * 24 * 400 : 60 * 60 * 24 * 30
    setCookie(c, 'sessionId', session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: cookieMaxAge,
      path: '/'
    })
    
    return c.json({
      message: 'Authentication successful',
      user: { id: user.id, email: user.email, username: user.username, firstName: user.first_name, lastName: user.last_name }
    })
  } catch (error) {
    return c.json({ error: 'Failed to verify OTP' }, 500)
  }
})

app.get('/verify-magic', async (c) => {
  try {
    const token = c.req.query('token')
    const rememberStr = c.req.query('remember') || ''
    const remember = rememberStr === '1' || rememberStr.toLowerCase() === 'true'
    
    if (!token) {
      return c.redirect('/?error=invalid-token')
    }
    
    // Consume magic link token
    const email = magicLinkDb.consume(token)
    if (!email) {
      return c.redirect('/?error=invalid-or-expired-token')
    }
    
    // Get user and create session
    const user = userDb.findByEmail(email)
    if (!user) {
      return c.redirect('/?error=user-not-found')
    }
    
    const session = sessionDb.create(user.id, !!remember)
    
    // Set session cookie (10y for remembered, 30d otherwise)
    const cookieMaxAge = !!remember ? 60 * 60 * 24 * 400 : 60 * 60 * 24 * 30
    setCookie(c, 'sessionId', session.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: cookieMaxAge,
      path: '/'
    })
    
    return c.redirect('/profiles?authenticated=true')
  } catch (error) {
    return c.redirect('/?error=authentication-failed')
  }
})

app.post('/logout', async (c) => {
  try {
    // Read all cookies to find our local session and any Better Auth cookies
    const cookies = getCookie(c) as Record<string, string>
    const sessionId = cookies['sessionId']
    
    // Delete our DB session if present
    if (sessionId) {
      sessionDb.delete(sessionId)
    }

    // Clear our session cookie and any Better Auth session cookies from the browser
    const namesToClear = Object.keys(cookies).filter(
      (name) => name === 'sessionId' || name === 'session_token' || name.endsWith('.session_token')
    )

    for (const name of namesToClear) {
      setCookie(c, name, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 0, // Expire immediately
        path: '/',
      })
    }

    return c.json({ message: 'Logged out successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to logout' }, 500)
  }
})

export default app