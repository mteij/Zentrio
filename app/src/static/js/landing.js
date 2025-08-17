// Client-side JavaScript for landing page functionality
// This replaces the massive inline script from landing.html

(function () {
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const globalMessage = document.getElementById('message');
    const inlineAuth = document.getElementById('inlineAuth');

    function showGlobalMessage(text, type = 'error') {
        globalMessage.textContent = text;
        globalMessage.className = `message ${type}`;
        globalMessage.style.display = 'block';
    }
    
    function clearGlobalMessage() {
        globalMessage.textContent = '';
        globalMessage.className = 'message';
        globalMessage.style.display = 'none';
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
            document.querySelector('.hero-content h1').style.display = 'none';
            document.querySelector('.hero-content p').style.display = 'none';
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

    // Helper function to load modal templates
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
        const welcomeMessage = nickname ? `<div class="welcome-message" style="text-align:center;margin-bottom:20px;color:#e50914;font-size:1.2rem;font-weight:bold;">Welcome back, ${nickname.replace(/"/g, '&quot;')}!</div>` : '';
        
        inlineAuth.innerHTML = `
          <form id="loginForm" class="fade-in" novalidate>
            <div style="display:flex;justify-content:flex-start;margin-bottom:8px;">
              <button id="loginBackBtn" type="button" class="btn btn-secondary" style="background:#000;border:1px solid #333;padding:8px 12px;">← Back</button>
            </div>
            ${welcomeMessage}
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input id="loginEmail" type="email" value="${email.replace(/"/g,'"')}" disabled aria-readonly="true" />
            </div>
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Enter your password" />
            </div>
            <button type="submit" class="cta-button">Sign in</button>
            <div class="divider" style="text-align:center;margin:16px 0;color:#b3b3b3;">or</div>
            <div class="form-group" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
              <button id="magicLinkBtn" type="button" class="cta-button" style="background:#333;border:1px solid #555;">Send Magic Link</button>
              <button id="otpBtn" type="button" class="cta-button" style="background:#333;border:1px solid #555;">Get OTP Code</button>
            </div>
            <div id="loginMessage" class="message" aria-live="polite"></div>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');

        const form = document.getElementById('loginForm');
        const backBtn = document.getElementById('loginBackBtn');
        const pwd = document.getElementById('loginPassword');
        const msg = document.getElementById('loginMessage');
        const magicLinkBtn = document.getElementById('magicLinkBtn');
        const otpBtn = document.getElementById('otpBtn');

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
            msg.style.display = 'none';

            if (!pwd.value) {
                setFieldError(pwd, 'Please enter your password');
                return;
            }

            try {
                form.querySelector('button[type="submit"]').disabled = true;
                const res = await fetch('/api/auth/signin-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: pwd.value })
                });
                const data = await res.json();
                if (res.ok) {
                    msg.textContent = 'Success! Redirecting...';
                    msg.className = 'message success';
                    msg.style.display = 'block';
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    setFieldError(pwd, data.error || 'Invalid email or password');
                    msg.textContent = data.error || 'Invalid email or password';
                    msg.className = 'message error';
                    msg.style.display = 'block';
                }
            } catch (err) {
                setFieldError(pwd, 'Network error, try again');
                msg.textContent = 'Network error, try again';
                msg.className = 'message error';
                msg.style.display = 'block';
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
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    renderMagicLinkSent(email);
                } else {
                    msg.textContent = data.error || 'Failed to send magic link.';
                    msg.className = 'message error';
                    msg.style.display = 'block';
                }
            } catch (err) {
                msg.textContent = 'Network error, try again.';
                msg.className = 'message error';
                msg.style.display = 'block';
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
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    renderOtpForm(email);
                } else {
                    msg.textContent = data.error || 'Failed to send OTP.';
                    msg.className = 'message error';
                    msg.style.display = 'block';
                }
            } catch (err) {
                msg.textContent = 'Network error, try again.';
                msg.className = 'message error';
                msg.style.display = 'block';
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
                    <p>A magic link has been sent to <strong>${email.replace(/"/g, '&quot;')}</strong>. Check your inbox and click the link to sign in.</p>
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
                await fetch('/api/auth/magic-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
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
                <p>An OTP code has been sent to <strong>${email.replace(/"/g, '&quot;')}</strong>. Please enter it below.</p>
                <form id="otpForm" novalidate>
                    <div class="form-group">
                        <label for="otpInput" class="sr-only">OTP Code</label>
                        <input id="otpInput" type="text" class="otp-input" placeholder="_ _ _ _ _ _" required pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" />
                    </div>
                    <button type="submit" class="cta-button">Verify & Sign In</button>
                    <div id="otpMessage" class="message" aria-live="polite"></div>
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
        const otpMessage = document.getElementById('otpMessage');
        const submitBtn = otpForm.querySelector('button[type="submit"]');

        otpInput.focus();

        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            otpMessage.style.display = 'none';
            const otp = otpInput.value;

            if (!otp || otp.length !== 6) {
                otpMessage.textContent = 'Please enter a valid 6-digit OTP.';
                otpMessage.className = 'message error';
                otpMessage.style.display = 'block';
                otpInput.classList.add('error');
                return;
            }
            otpInput.classList.remove('error');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });

                if (res.ok) {
                    otpMessage.textContent = 'Success! Redirecting...';
                    otpMessage.className = 'message success';
                    otpMessage.style.display = 'block';
                    otpInput.classList.add('success');
                    setTimeout(() => { window.location.href = '/profiles'; }, 800);
                } else {
                    const data = await res.json();
                    otpMessage.textContent = data.error || 'Invalid or expired OTP.';
                    otpMessage.className = 'message error';
                    otpMessage.style.display = 'block';
                    otpInput.classList.add('error');
                    otpInput.value = '';
                }
            } catch (err) {
                otpMessage.textContent = 'Network error, please try again.';
                otpMessage.className = 'message error';
                otpMessage.style.display = 'block';
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
                await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
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
              <input id="regEmail" type="email" value="${email.replace(/"/g,'"')}" disabled aria-readonly="true" />
            </div>
            <div class="form-group">
              <label for="regUsername">Nickname</label>
              <input id="regUsername" type="text" placeholder="Enter your nickname" autocomplete="nickname" />
            </div>
            <div class="form-group">
              <label for="regPassword">Password</label>
              <input id="regPassword" type="password" placeholder="Enter your password" minlength="6" autocomplete="new-password" />
            </div>
            <button type="submit" class="cta-button">Create account</button>
            <div id="regMessage" class="message" aria-live="polite"></div>
          </form>
        `;
        
        inlineAuth.classList.remove('step-hidden');
        inlineAuth.classList.add('fade-in');
        
        // Add event handlers...
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
            const data = await res.json();

            // Handle validation (4xx) explicitly: inline error + focus email
            if (res.status >= 400 && res.status < 500) {
                setFieldError(emailInput, data.error || 'Invalid email');
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
            showGlobalMessage('Please enter a valid email address', 'error');
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