// Client-side JavaScript for landing page functionality
// This replaces the massive inline script from landing.html

(function () {
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    // Keep reference for legacy markup but stop using inline message boxes; use toasts instead.
    const globalMessage = document.getElementById('message');
    const inlineAuth = document.getElementById('inlineAuth');

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

    // Safely escape text for HTML contexts (text nodes and attribute values)
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Backward-compatible API (no-op visually except via toast)
    function showGlobalMessage(text, type = 'error') {
        toast(type, type === 'error' ? 'Error' : (type === 'success' ? 'Success' : 'Notice'), text);
        if (globalMessage) {
            globalMessage.style.display = 'none';
            globalMessage.textContent = '';
        }
    }
    
    function clearGlobalMessage() {
        if (globalMessage) {
            globalMessage.textContent = '';
            globalMessage.className = 'message';
            globalMessage.style.display = 'none';
        }
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

    // Helper function to load modal templates (kept for compatibility if needed later)
    async function loadModalTemplate(templatePath) {
        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${templatePath}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Error loading modal template:', error);
            return null;
        }
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
              <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Enter your password" />
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
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');

        const form = document.getElementById('loginForm');
        const backBtn = document.getElementById('loginBackBtn');
        const pwd = document.getElementById('loginPassword');
        const magicLinkBtn = document.getElementById('magicLinkBtn');
        const otpBtn = document.getElementById('otpBtn');
        const rememberEl = document.getElementById('rememberMe');
        if (rememberEl) {
          rememberEl.checked = getRememberPref();
          rememberEl.addEventListener('change', () => setRememberPref(rememberEl.checked));
        }

        // Back to email step
        backBtn?.addEventListener('click', () => {
          showEmailStep();
          inlineAuth.classList.add('step-hidden');
          inlineAuth.innerHTML = '';
          clearGlobalMessage();
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
                const res = await fetch('/api/auth/signin-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: pwd.value, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    toast('success', 'Signed in', 'Success! Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        setFieldError(pwd, data.error || 'Invalid email or password');
                        toast('error', 'Sign in failed', data.error || 'Invalid email or password');
                    }
                }
            } catch (err) {
                setFieldError(pwd, 'Network error, try again');
                toast('error', 'Network error', 'Please try again.');
            } finally {
                form.querySelector('button[type="submit"]').disabled = false;
            }
        });

        // Magic link and OTP handlers
        magicLinkBtn.addEventListener('click', async () => {
            try {
                magicLinkBtn.disabled = true;
                magicLinkBtn.textContent = 'Sending...';
                const res = await fetch('/api/auth/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    renderMagicLinkSent(email);
                    toast('success', 'Magic link sent', 'Check your inbox to sign in.');
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'Magic link failed', data.error || 'Failed to send magic link.');
                    }
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                magicLinkBtn.disabled = false;
                magicLinkBtn.textContent = 'Send Magic Link';
            }
        });

        otpBtn.addEventListener('click', async () => {
            try {
                otpBtn.disabled = true;
                otpBtn.textContent = 'Sending...';
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    renderOtpForm(email);
                    toast('success', 'OTP sent', 'We sent a 6-digit code to your email.');
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'OTP send failed', data.error || 'Failed to send OTP.');
                    }
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                otpBtn.disabled = false;
                otpBtn.textContent = 'Get OTP Code';
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
                const res = await fetch('/api/auth/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    toast('success', 'Magic link sent', 'Check your inbox.');
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'Magic link failed', data.error || 'Failed to send magic link.');
                    }
                }
            } catch {
                toast('error', 'Network error', 'Please try again.');
            } finally {
                setTimeout(() => {
                    resendBtn.textContent = "Didn't receive it? Resend link";
                    resendBtn.classList.remove('disabled');
                }, 5000); // Prevent spamming
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
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, remember: getRememberPref() })
                });

                if (res.ok) {
                    otpInput.classList.add('success');
                    toast('success', 'Verified', 'Success! Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    const data = await res.json().catch(() => ({}));
                    otpInput.classList.add('error');
                    otpInput.value = '';
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'Verification failed', data.error || 'Invalid or expired OTP.');
                    }
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
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    toast('success', 'OTP sent', 'Check your inbox for the new code.');
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'OTP send failed', data.error || 'Failed to resend OTP.');
                    }
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
        // Registration form implementation
        // Simplified for brevity
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
              <input id="regPassword" type="password" placeholder="Enter your password" minlength="6" autocomplete="new-password" />
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
            clearGlobalMessage();
            emailInput.focus();
        });

        const rememberEl = document.getElementById('rememberMe');
        if (rememberEl) {
            rememberEl.checked = getRememberPref();
            rememberEl.addEventListener('change', () => setRememberPref(rememberEl.checked));
        }

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
            if (password.length < 6) {
                setFieldError(passwordInput, 'Password must be at least 6 characters');
                toast('warning', 'Weak password', 'Password must be at least 6 characters');
                return;
            }

            try {
                form.querySelector('button[type="submit"]').disabled = true;
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username, password, remember: getRememberPref() })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    toast('success', 'Account created', 'Redirecting...');
                    setTimeout(() => {
                        window.location.href = data.redirect || '/';
                    }, 800);
                } else {
                    if (res.status === 429) {
                        toast('error', 'Too many requests', 'Please try again later.');
                    } else {
                        toast('error', 'Registration failed', data.error || 'Registration failed');
                    }
                }
            } catch (err) {
                toast('error', 'Network error', 'Please try again');
            } finally {
                form.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    async function identifyAndRender(email) {
        clearGlobalMessage();
        clearFieldError(emailInput);
        showLoading();
        try {
            const res = await fetch('/api/auth/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json().catch(() => ({}));

            // Handle validation (4xx) explicitly: field error + toast
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
            showGlobalMessage(err.message || 'Something went wrong', 'error');
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
            showGlobalMessage('Please enter a valid email address', 'warning');
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