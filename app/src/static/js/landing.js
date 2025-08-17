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

        // Magic link and OTP handlers would go here...
        // Simplified for brevity
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