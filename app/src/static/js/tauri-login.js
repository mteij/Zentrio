// Client-side JavaScript for Tauri login page functionality
// Adapted from landing.js but tailored for the Tauri login flow

(function () {
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const inlineAuth = document.getElementById('inlineAuth');
    const ssoContainer = document.getElementById('sso-container');
    const globalBackBtn = document.getElementById('globalBackBtn');
    let authProviders = {};

    function setBackButton(onClick) {
        if (!globalBackBtn) return;
        if (onClick) {
            globalBackBtn.style.display = 'flex';
            globalBackBtn.onclick = onClick;
        } else {
            globalBackBtn.style.display = 'none';
            globalBackBtn.onclick = null;
        }
    }

    // Fetch enabled providers
    fetch('/api/auth/providers')
        .then(res => res.json())
        .then(data => {
            authProviders = data;
            renderSSOButtons();
        })
        .catch(err => console.error('Failed to fetch auth providers', err));

    function renderSSOButtons() {
        if (!ssoContainer) return;
        ssoContainer.innerHTML = ''; // Clear existing

        const createBtn = (provider, iconName, label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sso-button';
            // Custom styling for Tauri login page
            btn.style.cssText = `
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                color: white;
                font-weight: 500;
                transition: all 0.2s ease;
                width: 100%;
            `;
            
            // Add hover effect via JS since we're using inline styles
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.transform = 'translateY(-1px)';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(255, 255, 255, 0.05)';
                btn.style.transform = 'translateY(0)';
            };

            btn.innerHTML = `<span class="iconify" data-icon="mdi:${iconName}" data-inline="false" style="font-size: 20px;"></span> <span>Continue with ${label}</span>`;
            
            btn.onclick = async () => {
                try {
                    const { open } = window.__TAURI__.shell;
                    
                    // Use the proxy endpoint to initiate the flow in the system browser
                    // This ensures the state cookie is set in the same jar as the callback
                    const callbackURL = 'zentrio://auth/callback';
                    const proxyUrl = `${window.location.origin}/api/auth/login-proxy?provider=${provider}&callbackURL=${encodeURIComponent(callbackURL)}`;
                    
                    await open(proxyUrl);
                    
                    // Show a message to the user
                    toast('info', 'Browser Opened', 'Please complete the login in your browser.');
                } catch (err) {
                    console.error('Social login error:', err);
                    toast('error', 'Login failed', 'Could not connect to server');
                }
            };
            return btn;
        };

        if (authProviders.google) {
            ssoContainer.appendChild(createBtn('google', 'google', 'Google'));
        }
        if (authProviders.github) {
            ssoContainer.appendChild(createBtn('github', 'github', 'GitHub'));
        }
        if (authProviders.discord) {
            ssoContainer.appendChild(createBtn('discord', 'discord', 'Discord'));
        }
        if (authProviders.oidc) {
            ssoContainer.appendChild(createBtn('oidc', 'openid', authProviders.oidcName));
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
            "'": '&#039;'
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
            err.style.color = '#ef4444';
            err.style.fontSize = '0.85rem';
            err.style.marginTop = '5px';
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
        emailForm.style.display = 'none';
        const welcomeHeader = document.querySelector('.text-center');
        if (welcomeHeader) welcomeHeader.style.display = 'none';

        // Hide SSO buttons
        if (ssoContainer) ssoContainer.style.display = 'none';
        
        // Hide divider
        const divider = document.getElementById('main-divider');
        if (divider) divider.style.display = 'none';
    }
    
    function showEmailStep() {
        emailForm.style.display = 'flex';
        const welcomeHeader = document.querySelector('.text-center');
        if (welcomeHeader) welcomeHeader.style.display = 'block';

        const title = document.getElementById('page-title');
        if (title) title.textContent = 'Welcome Back';

        // Show SSO buttons
        if (ssoContainer) ssoContainer.style.display = 'flex';
        
        // Show divider
        const divider = document.getElementById('main-divider');
        if (divider) divider.style.display = 'flex';
        
        setBackButton(() => window.location.href = '/');
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
        const title = document.getElementById('page-title');
        if (title) title.textContent = nickname ? `Hello, ${nickname}!` : 'Welcome Back';

        inlineAuth.innerHTML = `
          <form id="loginForm" class="fade-in" novalidate style="display: flex; flex-direction: column; gap: 15px;">
            <div class="form-group">
              <label for="loginEmail" style="display:block;margin-bottom:8px;color:#aaa;">Email</label>
              <input id="loginEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
            </div>
            <div class="form-group">
              <label for="loginPassword" style="display:block;margin-bottom:8px;color:#aaa;">Password</label>
              <div class="password-input-container" style="position: relative; width: 100%;">
                <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Enter your password" style="width:100%;padding:12px;padding-right:40px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
                <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; color: #b3b3b3; z-index: 2;">
                  <span class="iconify" data-icon="mdi:eye" data-inline="false" style="font-size: 20px;"></span>
                </button>
              </div>
            </div>
            <div class="form-group remember-row" style="display:flex;align-items:center;">
              <label class="remember-checkbox" for="rememberMe" style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;">
                <input id="rememberMe" type="checkbox" style="width:16px;height:16px;" />
                <span>Stay signed in on this device</span>
              </label>
            </div>
            <button type="submit" class="cta-button" style="width:100%;padding:12px;background:#e50914;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Sign in</button>
            <div class="divider" style="text-align:center;margin:10px 0;color:#666;font-size:0.9rem;">or</div>
            <div class="form-group" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
              <button id="magicLinkBtn" type="button" class="cta-button" style="flex:1;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;cursor:pointer;">Send Magic Link</button>
              <button id="otpBtn" type="button" class="cta-button" style="flex:1;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;cursor:pointer;">Get OTP Code</button>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <a href="#" id="forgotPasswordLink" style="color:#aaa;text-decoration:underline;font-size:0.9rem;">Forgot Password?</a>
            </div>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');

        const form = document.getElementById('loginForm');
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
        setBackButton(() => {
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
                        callbackURL: window.location.origin
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
                        callbackURL: window.location.origin,
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
            <div class="fade-in" style="display: flex; flex-direction: column; gap: 15px;">
                <h3 style="margin:0;font-size:1.5rem;">Reset Password</h3>
                <p style="color:#aaa;margin:0;">Enter your email to receive a password reset link.</p>
                <form id="forgotPasswordForm" novalidate style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="form-group">
                        <label for="forgotEmail" style="display:block;margin-bottom:8px;color:#aaa;">Email</label>
                        <input id="forgotEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
                    </div>
                    <button type="submit" class="cta-button" style="width:100%;padding:12px;background:#e50914;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Send Reset Link</button>
                </form>
            </div>
        `;

        setBackButton(() => {
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
            <div class="magic-link-container fade-in" style="display: flex; flex-direction: column; gap: 15px; text-align: center;">
                <h3 style="margin:0;font-size:1.5rem;display:flex;align-items:center;justify-content:center;gap:10px;">
                    <svg class="email-icon" viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>
                    Magic Link Sent
                </h3>
                <div class="magic-link-sent">
                    <p style="color:#aaa;line-height:1.5;">A magic link has been sent to <strong>${escapeHtml(email)}</strong>. Check your inbox and click the link to sign in.</p>
                </div>
                <p class="resend-text" id="resendMagicLink" style="color:#e50914;cursor:pointer;text-decoration:underline;">Didn't receive it? Resend link</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        setBackButton(() => {
            renderLoginForm(email);
        });

        const resendBtn = document.getElementById('resendMagicLink');
        resendBtn.addEventListener('click', async () => {
            resendBtn.textContent = 'Sending...';
            resendBtn.style.opacity = '0.5';
            resendBtn.style.pointerEvents = 'none';
            try {
                const res = await fetch('/api/auth/sign-in/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        callbackURL: window.location.origin,
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
                    resendBtn.style.opacity = '1';
                    resendBtn.style.pointerEvents = 'auto';
                }, 5000);
            }
        });
    }

    function renderOtpForm(email) {
        inlineAuth.innerHTML = `
            <div class="otp-container fade-in" style="display: flex; flex-direction: column; gap: 15px; text-align: center;">
                <h3 style="margin:0;font-size:1.5rem;">Enter OTP Code</h3>
                <p style="color:#aaa;margin:0;">An OTP code has been sent to <strong>${escapeHtml(email)}</strong>. Please enter it below.</p>
                <form id="otpForm" novalidate style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="form-group">
                        <label for="otpInput" class="sr-only" style="display:none;">OTP Code</label>
                        <input id="otpInput" type="text" class="otp-input" placeholder="_ _ _ _ _ _" required pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;text-align:center;letter-spacing:5px;font-size:1.2rem;" />
                    </div>
                    <button type="submit" class="cta-button" style="width:100%;padding:12px;background:#e50914;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Verify & Sign In</button>
                </form>
                <p class="resend-text" id="resendOtp" style="color:#e50914;cursor:pointer;text-decoration:underline;">Resend OTP</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        setBackButton(() => {
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
                otpInput.style.borderColor = '#ef4444';
                toast('warning', 'Invalid OTP', 'Please enter a valid 6-digit OTP.');
                return;
            }
            otpInput.style.borderColor = 'rgba(255,255,255,0.1)';

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
                    otpInput.style.borderColor = '#22c55e';
                    toast('success', 'Verified', 'Success! Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    otpInput.style.borderColor = '#ef4444';
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
            resendBtn.style.opacity = '0.5';
            resendBtn.style.pointerEvents = 'none';
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
                    resendBtn.style.opacity = '1';
                    resendBtn.style.pointerEvents = 'auto';
                }, 5000);
            }
        });
    }

    function renderRegisterForm(email) {
        inlineAuth.innerHTML = `
          <form id="registerInlineForm" class="fade-in" novalidate style="display: flex; flex-direction: column; gap: 15px;">
            <div class="form-group">
              <label for="regEmail" style="display:block;margin-bottom:8px;color:#aaa;">Email</label>
              <input id="regEmail" type="email" value="${escapeHtml(email)}" disabled aria-readonly="true" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
            </div>
            <div class="form-group">
              <label for="regUsername" style="display:block;margin-bottom:8px;color:#aaa;">Nickname</label>
              <input id="regUsername" type="text" placeholder="Enter your nickname" autocomplete="nickname" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
            </div>
            <div class="form-group">
              <label for="regPassword" style="display:block;margin-bottom:8px;color:#aaa;">Password</label>
              <div class="password-input-container" style="position: relative; width: 100%;">
                <input id="regPassword" type="password" placeholder="Enter your password" minlength="8" autocomplete="new-password" style="width:100%;padding:12px;padding-right:40px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;" />
                <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; color: #b3b3b3; z-index: 2;">
                  <span class="iconify" data-icon="mdi:eye" data-inline="false" style="font-size: 20px;"></span>
                </button>
              </div>
            </div>
            <div class="form-group remember-row" style="display:flex;align-items:center;">
              <label class="remember-checkbox" for="rememberMe" style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;">
                <input id="rememberMe" type="checkbox" style="width:16px;height:16px;" />
                <span>Stay signed in on this device</span>
              </label>
            </div>
            <button type="submit" class="cta-button" style="width:100%;padding:12px;background:#e50914;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Create account</button>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');
        
        const form = document.getElementById('registerInlineForm');
        const usernameInput = document.getElementById('regUsername');
        const passwordInput = document.getElementById('regPassword');

        setBackButton(() => {
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
                        callbackURL: window.location.origin
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
            <div class="magic-link-container fade-in" style="display: flex; flex-direction: column; gap: 15px; text-align: center;">
                <h3 style="margin:0;font-size:1.5rem;display:flex;align-items:center;justify-content:center;gap:10px;">
                    <svg class="email-icon" viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>
                    Verify your email
                </h3>
                <div class="magic-link-sent">
                    <p style="color:#aaa;line-height:1.5;">We've sent a verification link to <strong>${escapeHtml(email)}</strong>. Please check your inbox and click the link to activate your account.</p>
                </div>
                <p class="resend-text" id="resendVerification" style="color:#e50914;cursor:pointer;text-decoration:underline;">Didn't receive it? Resend email</p>
            </div>
        `;
        inlineAuth.classList.remove('step-hidden');

        setBackButton(() => {
            renderLoginForm(email);
        });

        const resendBtn = document.getElementById('resendVerification');
        resendBtn.addEventListener('click', async () => {
            resendBtn.textContent = 'Sending...';
            resendBtn.style.opacity = '0.5';
            resendBtn.style.pointerEvents = 'none';
            try {
                const res = await fetch('/api/auth/send-verification-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        callbackURL: window.location.origin
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
                    resendBtn.style.opacity = '1';
                    resendBtn.style.pointerEvents = 'auto';
                }, 5000);
            }
        });
    }

    async function identifyAndRender(email) {
        clearFieldError(emailInput);
        showLoading();
        try {
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
        setBackButton(() => window.location.href = '/');
    }
})();