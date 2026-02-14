export const getEmailConfig = () => ({
  from: process.env.EMAIL_FROM || 'Zentrio <noreply@zentrio.app>',
  appUrl: process.env.APP_URL || 'http://localhost:3000'
})

// Shared base layout for all emails
const getBaseEmailHtml = (title: string, content: string, footerInfo: string = '') => {
  const { appUrl } = getEmailConfig()
  const currentYear = new Date().getFullYear()
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo-text { color: #dc2626; font-size: 24px; font-weight: 800; text-decoration: none; letter-spacing: -0.5px; }
    .card { background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    h1 { color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; letter-spacing: -0.5px; text-align: center; }
    p { margin: 0 0 16px 0; line-height: 1.6; color: #a1a1aa; font-size: 16px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; transition: background-color 0.2s; }
    .btn:hover { background-color: #b91c1c; }
    .code-block { background-color: #27272a; border: 1px solid #3f3f46; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 4px; color: #ffffff; margin: 24px 0; }
    .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #52525b; }
    .footer a { color: #71717a; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .secondary-text { font-size: 14px; color: #71717a; margin-top: 24px; text-align: center; }
    .link-fallback { word-break: break-all; color: #71717a; font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <a href="${appUrl}" class="logo-text">Zentrio</a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p style="margin-bottom: 8px;">© ${currentYear} Zentrio</p>
      ${footerInfo}
    </div>
  </div>
</body>
</html>
  `
}

export const getMagicLinkTemplate = (magicLink: string) => {
  const content = `
    <h1>Sign in to Zentrio</h1>
    <p style="text-align: center;">You requested a secure sign-in link. Click the button below to sign in instantly.</p>
    
    <div class="btn-container">
      <a href="${magicLink}" class="btn">Sign In Now</a>
    </div>

    <div class="secondary-text">
      <p style="font-size: 13px; margin-bottom: 4px;">Link not working? Paste this URL into your browser:</p>
      <div class="link-fallback">${magicLink}</div>
    </div>
    
    <p style="text-align: center; margin-top: 32px; font-size: 13px; color: #52525b;">
      If you didn't request this email, you can safely ignore it.
    </p>
  `
  return getBaseEmailHtml('Sign in to Zentrio', content)
}

export const getOtpTemplate = (otp: string) => {
  const content = `
    <h1>Verify your email</h1>
    <p style="text-align: center;">Use the code below to complete your verification.</p>
    
    <div class="code-block">${otp}</div>
    
    <p style="text-align: center; margin-top: 24px; font-size: 13px; color: #52525b;">
      This code expires in 15 minutes.
    </p>
  `
  return getBaseEmailHtml('Verify your email', content)
}

export const getWelcomeTemplate = (username: string) => {
  const { appUrl } = getEmailConfig()
  const content = `
    <h1>Welcome to Zentrio!</h1>
    <p style="text-align: center;">Hey <strong>${username}</strong>, thanks for joining us. We're excited to have you on board.</p>
    
    <div class="btn-container">
      <a href="${appUrl}" class="btn">Get Started</a>
    </div>
    
    <p style="text-align: center;">Explore your personal streaming library and start organizing your favorite content.</p>
  `
  return getBaseEmailHtml('Welcome to Zentrio', content)
}

export const getVerificationHelperTemplate = (link: string) => {
  const content = `
    <h1>Verify Account</h1>
    <p style="text-align: center;">Click the button below to verify your email address.</p>
    
    <div class="btn-container">
      <a href="${link}" class="btn">Verify Email</a>
    </div>
    
    <div class="secondary-text">
      <div class="link-fallback">${link}</div>
    </div>
  `
  return getBaseEmailHtml('Verify Account', content)
}

export const getPasswordResetTemplate = (link: string) => {
  const content = `
    <h1>Reset Password</h1>
    <p style="text-align: center;">We received a request to reset your password. Click below to choose a new one.</p>
    
    <div class="btn-container">
      <a href="${link}" class="btn">Reset Password</a>
    </div>
    
    <div class="secondary-text">
      <div class="link-fallback">${link}</div>
    </div>

    <p style="text-align: center; margin-top: 24px; font-size: 13px; color: #52525b;">
      If you didn't ask to reset your password, you can safely ignore this email.
    </p>
  `
  return getBaseEmailHtml('Reset Password', content)
}

export const getSharingInvitationTemplate = (inviterName: string, listName: string, inviteUrl: string) => {
  const content = `
    <h1>List Invitation</h1>
    <p style="text-align: center;"><strong>${inviterName}</strong> invited you to collaborate on their list <strong>"${listName}"</strong>.</p>
    
    <div class="btn-container">
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
    </div>
    
    <p style="text-align: center;">Join the list to add movies, TV shows, and track what you've watched together.</p>
  `
  return getBaseEmailHtml(`${inviterName} shared a list with you`, content)
}

export const getProfileSharingInvitationTemplate = (inviterName: string, inviteUrl: string) => {
  const content = `
    <h1>Profile Access</h1>
    <p style="text-align: center;"><strong>${inviterName}</strong> invited you to access their Zentrio profile.</p>
    
    <div class="btn-container">
      <a href="${inviteUrl}" class="btn">Accept Access</a>
    </div>
    
    <p style="text-align: center;">This will allow you to view their lists and watch activity.</p>
  `
  return getBaseEmailHtml(`${inviterName} shared their profile`, content)
}
