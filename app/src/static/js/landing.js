// Client-side JavaScript for landing page functionality
// Uses fetch for authentication (vanilla JS compatible)

(function () {
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const inlineAuth = document.getElementById('inlineAuth');
    let authProviders = {};

    // Fetch enabled providers
    fetch('/api/auth/providers')
        .then(res => res.json())
        .then(data => {
            authProviders = data;
            renderSSOButtons();
        })
        .catch(err => console.error('Failed to fetch auth providers', err));

    function renderSSOButtons() {
        const container = document.createElement('div');
        container.className = 'sso-container';
        container.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap;';

        const createBtn = (provider, iconName, label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sso-button';
            btn.style.cssText = 'background:#333;border:1px solid #555;padding:10px;border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:8px;color:white;';
            btn.innerHTML = `<span class="iconify" data-icon="mdi:${iconName}" data-inline="false" style="font-size: 20px;"></span> <span>${label}</span>`;
            btn.onclick = async () => {
                try {
                    const res = await fetch('/api/auth/sign-in/social', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider,
                            callbackURL: '/profiles'
                        })
                    });
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    } else if (data.error) {
                        toast('error', 'Login failed', data.message || data.error);
                    }
                } catch (err) {
                    console.error('Social login error:', err);
                    toast('error', 'Login failed', 'Could not connect to server');
                }
            };
            return btn;
        };

        if (authProviders.google) {
            container.appendChild(createBtn('google', 'google', 'Google'));
        }
        if (authProviders.github) {
            container.appendChild(createBtn('github', 'github', 'GitHub'));
        }
        if (authProviders.discord) {
            container.appendChild(createBtn('discord', 'discord', 'Discord'));
        }
        if (authProviders.oidc) {
            container.appendChild(createBtn('oidc', 'openid', authProviders.oidcName));
        }

        if (container.children.length > 0) {
            const heroContent = document.querySelector('.hero-content');
            const form = document.getElementById('emailForm');
            if (heroContent && form) {
                // Insert after the form
                form.parentNode.insertBefore(container, form.nextSibling);
            }
        }
    }

    // Toast helpers — unify usage across auth flow
    function toast(type, title, message) {
        try {
            // Map common synonyms to our toast types: message | warning | error
            const t = type === 'success' ? 'message' : (type === 'info' ? 'message' : type);
            const defaultTitle =
                t === 'error' ? 'Error' :
                t === 'warning' ? 'Warning' :
                'Notice';
            window.addToast(t, title || defaultTitle, message || '');
        } catch (e) {
            // Soft fallback for environments without toast.js loaded
            console.warn('[Toast]', type, title, message);
        }
    }

    // Safely escape text for HTML contexts
    function escapeHtml(str) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function setFieldError(inputEl, text) {
        if (!inputEl) return;
        inputEl.setAttribute('aria-invalid', 'true');
        let err = inputEl.parentElement.querySelector(`#${inputEl.id}-error`);
        if (!err) {
            err = document.createElement('div');
            err.id = `${inputEl.id}-error`;
            err.className = 'field-error';
            err.setAttribute('role', 'alert');
            inputEl.parentElement.appendChild(err);
        }
        inputEl.setAttribute('aria-describedby', err.id);
        err.textContent = text;
        inputEl.focus();
    }
    
    function clearFieldError(inputEl) {
        if (!inputEl) return;
        inputEl.removeAttribute('aria-invalid');
        const err = inputEl.parentElement.querySelector(`#${inputEl.id}-error`);
        if (err) err.remove();
        inputEl.removeAttribute('aria-describedby');
    }
    
    function hideEmailStep() {
        emailForm.classList.add('step-hidden');
        const heroContent = document.querySelector('.hero-content h1, .hero-content p');
        if (heroContent) {
            const h1 = document.querySelector('.hero-content h1');
            const p = document.querySelector('.hero-content p');
            if (h1) h1.style.display = 'none';
            if (p) p.style.display = 'none';
        }
    }
    
    function showEmailStep() {
        emailForm.classList.remove('step-hidden');
        const heroTitle = document.querySelector('.hero-content h1');
        const heroDesc = document.querySelector('.hero-content p');
        if (heroTitle) heroTitle.style.display = 'block';
        if (heroDesc) heroDesc.style.display = 'block';
    }
    
    function showLoading() {
        loading.style.display = 'block';
        submitBtn.disabled = true;
    }
    
    function hideLoading() {
        loading.style.display = 'none';
        submitBtn.disabled = false;
    }

    // Remember-me preference (local only)
    function getRememberPref() {
        try { return localStorage.getItem('zentrioRememberMe') === 'true'; } catch (e) { return false; }
    }
    function setRememberPref(val) {
        try { localStorage.setItem('zentrioRememberMe', val ? 'true' : 'false'); } catch (e) {}
    }

    function renderLoginForm(email, nickname = null) {
        const welcomeMessage = nickname ? `<div class="welcome-message" style="text-align:center;margin-bottom:20px;color:#e50914;font-size:1.2rem;font-weight:bold;">Welcome back, ${escapeHtml(nickname)}!</div>` : '';
        
        inlineAuth.innerHTML = `
          <form id="loginForm" class="fade-in" novalidate>
            <div style="display:flex;justify-content:flex-start;margin-bottom:8px;">
              <button id="loginBackBtn" type="button" class="btn btn-secondary" style="background:#000;border:1px solid #333;padding:8px 12px;">← Back</button>
            </div>
            ${welcomeMessage}
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input id="loginEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" />
            </div>
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <div class="password-input-container" style="position: relative; width: 100%;">
                <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Enter your password" style="padding-right: 40px;" />
                <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; color: #b3b3b3; z-index: 2;">
                  <span class="iconify" data-icon="mdi:eye" data-inline="false" style="font-size: 20px;"></span>
                </button>
              </div>
            </div>
            <div class="form-group remember-row">
              <label class="remember-checkbox" for="rememberMe">
                <input id="rememberMe" type="checkbox" />
                <span>Stay signed in on this device</span>
              </label>
            </div>
            <button type="submit" class="cta-button">Sign in</button>
            <div class="divider" style="text-align:center;margin:16px 0;color:#b3b3b3;">or</div>
            <div class="form-group" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
              <button id="magicLinkBtn" type="button" class="cta-button" style="background:#333;border:1px solid #555;">Send Magic Link</button>
              <button id="otpBtn" type="button" class="cta-button" style="background:#333;border:1px solid #555;">Get OTP Code</button>
            </div>
            <div style="text-align:center;margin-top:16px;">
                <a href="#" id="forgotPasswordLink" style="color:#b3b3b3;text-decoration:underline;font-size:0.9rem;">Forgot Password?</a>
            </div>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');

        const form = document.getElementById('loginForm');
        const backBtn = document.getElementById('loginBackBtn');
        const pwd = document.getElementById('loginPassword');
        const magicLinkBtn = document.getElementById('magicLinkBtn');
        const otpBtn = document.getElementById('otpBtn');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const rememberEl = document.getElementById('rememberMe');
        
        if (rememberEl) {
          rememberEl.checked = getRememberPref();
          rememberEl.addEventListener('change', () => setRememberPref(rememberEl.checked));
        }

        // Password toggle handler
        const toggleBtns = document.querySelectorAll('.password-toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const input = button.previousElementSibling;
                const icon = button.querySelector('.iconify');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye-off');
                } else {
                    input.type = 'password';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye');
                }
            });
        });

        // Back to email step
        backBtn?.addEventListener('click', () => {
          showEmailStep();
          inlineAuth.classList.add('step-hidden');
          inlineAuth.innerHTML = '';
          emailInput.focus();
        });

        pwd.focus();

        // Password submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFieldError(pwd);

            if (!pwd.value) {
                setFieldError(pwd, 'Please enter your password');
                toast('warning', 'Missing password', 'Please enter your password');
                return;
            }

            try {
                form.querySelector('button[type="submit"]').disabled = true;
                
                const res = await fetch('/api/auth/sign-in/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password: pwd.value,
                        rememberMe: getRememberPref(),
                        callbackURL: '/profiles'
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'Signed in', 'Success! Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    if (data.code === 'EMAIL_NOT_VERIFIED' || (data.message && data.message.toLowerCase().includes('verif'))) {
                        renderUnverifiedEmail(email);
                    } else {
                        const msg = data.message || data.error || 'Invalid email or password';
                        setFieldError(pwd, msg);
                        toast('error', 'Sign in failed', msg);
                    }
                }
            } catch (err) {
                setFieldError(pwd, 'Network error, try again');
                toast('error', 'Network error', 'Please try again.');
            } finally {
                form.querySelector('button[type="submit"]').disabled = false;
            }
        });

        // Magic link handler
        magicLinkBtn.addEventListener('click', async () => {
            try {
                magicLinkBtn.disabled = true;
                magicLinkBtn.textContent = 'Sending...';
                
                const res = await fetch('/api/auth/sign-in/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        callbackURL: '/profiles',
                        rememberMe: getRememberPref()
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    renderMagicLinkSent(email);
                    toast('success', 'Magic link sent', 'Check your inbox to sign in.');
                } else {
                    toast('error', 'Magic link failed', data.message || data.error || 'Failed to send magic link.');
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                magicLinkBtn.disabled = false;
                magicLinkBtn.textContent = 'Send Magic Link';
            }
        });

        // OTP handler
        otpBtn.addEventListener('click', async () => {
            try {
                otpBtn.disabled = true;
                otpBtn.textContent = 'Sending...';
                
                const res = await fetch('/api/auth/email-otp/send-verification-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, type: 'sign-in' })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    renderOtpForm(email);
                    toast('success', 'OTP sent', 'We sent a 6-digit code to your email.');
                } else {
                    toast('error', 'OTP send failed', data.message || data.error || 'Failed to send OTP.');
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                otpBtn.disabled = false;
                otpBtn.textContent = 'Get OTP Code';
            }
        });

        // Forgot Password handler
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            renderForgotPassword(email);
        });
    }

    function renderForgotPassword(email) {
        inlineAuth.innerHTML = `
            <div class="fade-in">
                <button id="forgotBackBtn" type="button" class="back-button">
                    <svg class="back-icon" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
                    Back
                </button>
                <h3>Reset Password</h3>
                <p>Enter your email to receive a password reset link.</p>
                <form id="forgotPasswordForm" novalidate>
                    <div class="form-group">
                        <label for="forgotEmail">Email</label>
                        <input id="forgotEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" />
                    </div>
                    <button type="submit" class="cta-button">Send Reset Link</button>
                </form>
            </div>
        `;

        document.getElementById('forgotBackBtn').addEventListener('click', () => {
            renderLoginForm(email);
        });

        const form = document.getElementById('forgotPasswordForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            
            try {
                btn.disabled = true;
                btn.textContent = 'Sending...';

                const res = await fetch('/api/auth/forget-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        redirectTo: window.location.origin + '/reset-password'
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'Email sent', 'Check your inbox for the reset link.');
                    // Optionally go back to login or show a success state
                    renderLoginForm(email); 
                } else {
                    toast('error', 'Failed', data.message || data.error || 'Failed to send reset link.');
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Reset Link';
            }
        });
    }

    function renderMagicLinkSent(email) {
        inlineAuth.innerHTML = `
            <div class="magic-link-container fade-in">
                <button id="magicLinkBackBtn" type="button" class="back-button">
                    <svg class="back-icon" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
                    Back
                </button>
                <h3>
                    <svg class="email-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>
                    Magic Link Sent
                </h3>
                <div class="magic-link-sent">
                    <p>A magic link has been sent to <strong>${escapeHtml(email)}</strong>. Check your inbox and click the link to sign in.</p>
                </div>
                <p class="resend-text" id="resendMagicLink">Didn't receive it? Resend link</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        document.getElementById('magicLinkBackBtn').addEventListener('click', () => {
            renderLoginForm(email);
        });

        const resendBtn = document.getElementById('resendMagicLink');
        resendBtn.addEventListener('click', async () => {
            resendBtn.textContent = 'Sending...';
            resendBtn.classList.add('disabled');
            try {
                const res = await fetch('/api/auth/sign-in/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        callbackURL: '/profiles',
                        rememberMe: getRememberPref()
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'Magic link sent', 'Check your inbox.');
                } else {
                    toast('error', 'Magic link failed', data.message || data.error || 'Failed to send magic link.');
                }
            } catch {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                setTimeout(() => {
                    resendBtn.textContent = "Didn't receive it? Resend link";
                    resendBtn.classList.remove('disabled');
                }, 5000);
            }
        });
    }

    function renderOtpForm(email) {
        inlineAuth.innerHTML = `
            <div class="otp-container fade-in">
                <button id="otpBackBtn" type="button" class="back-button">
                    <svg class="back-icon" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
                    Back
                </button>
                <h3>Enter OTP Code</h3>
                <p>An OTP code has been sent to <strong>${escapeHtml(email)}</strong>. Please enter it below.</p>
                <form id="otpForm" novalidate>
                    <div class="form-group">
                        <label for="otpInput" class="sr-only">OTP Code</label>
                        <input id="otpInput" type="text" class="otp-input" placeholder="_ _ _ _ _ _" required pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" />
                    </div>
                    <button type="submit" class="cta-button">Verify & Sign In</button>
                </form>
                <p class="resend-text" id="resendOtp">Resend OTP</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        document.getElementById('otpBackBtn').addEventListener('click', () => {
            renderLoginForm(email);
        });

        const otpForm = document.getElementById('otpForm');
        const otpInput = document.getElementById('otpInput');
        const submitBtn = otpForm.querySelector('button[type="submit"]');

        otpInput.focus();

        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = otpInput.value;

            if (!otp || otp.length !== 6) {
                otpInput.classList.add('error');
                toast('warning', 'Invalid OTP', 'Please enter a valid 6-digit OTP.');
                return;
            }
            otpInput.classList.remove('error');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                
                const res = await fetch('/api/auth/sign-in/email-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    otpInput.classList.add('success');
                    toast('success', 'Verified', 'Success! Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    otpInput.classList.add('error');
                    otpInput.value = '';
                    toast('error', 'Verification failed', data.message || data.error || 'Invalid or expired OTP.');
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Verify & Sign In';
            }
        });

        const resendBtn = document.getElementById('resendOtp');
        resendBtn.addEventListener('click', async () => {
            resendBtn.textContent = 'Sending...';
            resendBtn.classList.add('disabled');
            try {
                const res = await fetch('/api/auth/email-otp/send-verification-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, type: 'sign-in' })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'OTP sent', 'Check your inbox for the new code.');
                } else {
                    toast('error', 'OTP send failed', data.message || data.error || 'Failed to resend OTP.');
                }
            } catch {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                setTimeout(() => {
                    resendBtn.textContent = "Resend OTP";
                    resendBtn.classList.remove('disabled');
                }, 5000);
            }
        });
    }

    function renderRegisterForm(email) {
        inlineAuth.innerHTML = `
          <form id="registerInlineForm" class="fade-in" novalidate>
            <div style="display:flex;justify-content:flex-start;margin-bottom:8px;">
              <button id="registerBackBtn" type="button" class="btn btn-secondary" style="background:#000;border:1px solid #333;padding:8px 12px;">← Back</button>
            </div>
            <div class="form-group">
              <label for="regEmail">Email</label>
              <input id="regEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" />
            </div>
            <div class="form-group">
              <label for="regUsername">Nickname</label>
              <input id="regUsername" type="text" placeholder="Enter your nickname" autocomplete="nickname" />
            </div>
            <div class="form-group">
              <label for="regPassword">Password</label>
              <div class="password-input-container" style="position: relative; width: 100%;">
                <input id="regPassword" type="password" placeholder="Enter your password" minlength="8" autocomplete="new-password" style="padding-right: 40px;" />
                <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; color: #b3b3b3; z-index: 2;">
                  <span class="iconify" data-icon="mdi:eye" data-inline="false" style="font-size: 20px;"></span>
                </button>
              </div>
            </div>
            <div class="form-group remember-row">
              <label class="remember-checkbox" for="rememberMe">
                <input id="rememberMe" type="checkbox" />
                <span>Stay signed in on this device</span>
              </label>
            </div>
            <button type="submit" class="cta-button">Create account</button>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');
        
        const form = document.getElementById('registerInlineForm');
        const usernameInput = document.getElementById('regUsername');
        const passwordInput = document.getElementById('regPassword');
        const backBtn = document.getElementById('registerBackBtn');

        backBtn?.addEventListener('click', () => {
            showEmailStep();
            inlineAuth.classList.add('step-hidden');
            inlineAuth.innerHTML = '';
            emailInput.focus();
        });

        const rememberEl = document.getElementById('rememberMe');
        if (rememberEl) {
            rememberEl.checked = getRememberPref();
            rememberEl.addEventListener('change', () => setRememberPref(rememberEl.checked));
        }

        // Password toggle handler
        const toggleBtns = document.querySelectorAll('.password-toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const input = button.previousElementSibling;
                const icon = button.querySelector('.iconify');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye-off');
                } else {
                    input.type = 'password';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye');
                }
            });
        });

        usernameInput.focus();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFieldError(usernameInput);
            clearFieldError(passwordInput);

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username) {
                setFieldError(usernameInput, 'Please enter a nickname');
                toast('warning', 'Missing nickname', 'Please enter a nickname');
                return;
            }
            if (!password) {
                setFieldError(passwordInput, 'Please enter a password');
                toast('warning', 'Missing password', 'Please enter a password');
                return;
            }
            if (password.length < 8) {
                setFieldError(passwordInput, 'Password must be at least 8 characters');
                toast('warning', 'Weak password', 'Password must be at least 8 characters');
                return;
            }

            try {
                form.querySelector('button[type="submit"]').disabled = true;
                
                const res = await fetch('/api/auth/sign-up/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        name: username,
                        username,
                        rememberMe: getRememberPref(),
                        callbackURL: '/profiles'
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    renderUnverifiedEmail(email);
                    toast('success', 'Account created', 'Please verify your email.');
                } else {
                    toast('error', 'Registration failed', data.message || data.error || 'Registration failed');
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again');
            } finally {
                form.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    function renderUnverifiedEmail(email) {
        inlineAuth.innerHTML = `
            <div class="magic-link-container fade-in">
                <button id="unverifiedBackBtn" type="button" class="back-button">
                    <svg class="back-icon" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
                    Back
                </button>
                <h3>
                    <svg class="email-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>
                    Verify your email
                </h3>
                <div class="magic-link-sent">
                    <p>We've sent a verification link to <strong>${escapeHtml(email)}</strong>. Please check your inbox and click the link to activate your account.</p>
                </div>
                <p class="resend-text" id="resendVerification">Didn't receive it? Resend email</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        document.getElementById('unverifiedBackBtn').addEventListener('click', () => {
            renderLoginForm(email);
        });

        const resendBtn = document.getElementById('resendVerification');
        resendBtn.addEventListener('click', async () => {
            resendBtn.textContent = 'Sending...';
            resendBtn.classList.add('disabled');
            try {
                const res = await fetch('/api/auth/send-verification-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        callbackURL: '/profiles'
                    })
                });
                
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'Email sent', 'Check your inbox.');
                } else {
                    toast('error', 'Failed to send', data.message || data.error || 'Failed to send verification email.');
                }
            } catch {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                setTimeout(() => {
                    resendBtn.textContent = "Didn't receive it? Resend email";
                    resendBtn.classList.remove('disabled');
                }, 5000);
            }
        });
    }

    async function identifyAndRender(email) {
        // clearGlobalMessage(); // Removed as we use toasts
        clearFieldError(emailInput);
        showLoading();
        try {
            // We still use our custom endpoint for identification as Better Auth doesn't have a direct "check if user exists" public endpoint without trying to sign in/up
            const res = await fetch('/api/auth/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json().catch(() => ({}));

            if (res.status === 429) {
                toast('error', 'Too many requests', 'Please try again later.');
                return;
            }
            if (res.status >= 400 && res.status < 500) {
                setFieldError(emailInput, data.error || 'Invalid email');
                toast('warning', 'Invalid email', data.error || 'Please enter a valid email address');
                emailInput.focus();
                return;
            }
            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            hideEmailStep();
            if (data.exists) {
                renderLoginForm(email, data.nickname || null);
            } else {
                renderRegisterForm(email);
            }
        } catch (err) {
            toast('error', 'Error', err.message || 'Something went wrong');
            emailInput.focus();
        } finally {
            hideLoading();
        }
    }

    // Handle email form submission
    emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            toast('warning', 'Invalid email', 'Please enter a valid email address');
            emailInput.focus();
            return;
        }
        identifyAndRender(email);
    });

    // Query param handling
    const params = new URLSearchParams(window.location.search);
    const qpEmail = params.get('email') || '';
    const intent = params.get('intent');
    if (qpEmail) {
        emailInput.value = qpEmail;
    }
    if (intent && qpEmail) {
        hideEmailStep();
        if (intent === 'signin') {
            renderLoginForm(qpEmail);
        } else if (intent === 'register') {
            renderRegisterForm(qpEmail);
        } else {
            identifyAndRender(qpEmail);
        }
    } else {
        emailInput.focus();
    }
})();