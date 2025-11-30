// Client-side JavaScript for landing page functionality
// Uses fetch for authentication (vanilla JS compatible)

(function () {
    // DOM Elements
    const introView = document.getElementById('intro-view');
    const loginView = document.getElementById('login-view');
    const inlineAuth = document.getElementById('inlineAuth');
    const backBtnContainer = document.getElementById('back-btn-container');
    const setupProgress = document.getElementById('setup-progress');
    const setupError = document.getElementById('setup-error');
    const progressMessage = document.getElementById('progress-message');
    const progressFill = document.getElementById('progress-fill');
    const errorMessage = document.getElementById('error-message');
    const retryConnectionBtn = document.getElementById('retryConnectionBtn');
    const typewriterText = document.getElementById('typewriter-text');

    // State
    let authProviders = {};
    const DEFAULT_SERVER_URL = 'https://app.zentrio.eu';
    const SLOGAN = "Stream Your Way";

    // Initialize
    async function init() {
        // Start Typewriter Effect
        await typeWriter(SLOGAN);
        
        // Wait a bit after typing finishes
        await new Promise(r => setTimeout(r, 800));
        
        // Transition to Login
        transitionToLogin();

        // Background tasks
        if (retryConnectionBtn) {
            retryConnectionBtn.addEventListener('click', () => connectToServer(DEFAULT_SERVER_URL));
        }

        // Fetch enabled providers early
        try {
            const res = await fetch('/api/auth/providers');
            authProviders = await res.json();
        } catch (err) {
            console.error('Failed to fetch auth providers', err);
        }
    }

    function typeWriter(text) {
        return new Promise(resolve => {
            if (!typewriterText) {
                resolve();
                return;
            }
            
            let i = 0;
            const speed = 100; // ms per char

            function type() {
                if (i < text.length) {
                    typewriterText.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    resolve();
                }
            }
            type();
        });
    }

    function transitionToLogin() {
        if (introView) {
            // Zoom/Morph effect
            introView.classList.add('fade-out');
            
            // Animate logo specifically if needed, but CSS handles the container
            const logo = introView.querySelector('.logo-wrapper');
            if (logo) {
                logo.style.transform = 'scale(5) translateY(-50px)';
                logo.style.opacity = '0';
            }
        }

        setTimeout(() => {
            if (introView) introView.style.display = 'none';
            showLoginView();
        }, 600); // Match CSS transition time roughly
    }

    async function connectToServer(serverUrl) {
        try {
            // Test server connectivity
            const testResponse = await fetch(`${serverUrl}/api/auth/providers`, {
                method: 'GET',
                signal: AbortSignal.timeout(10000)
            });
            
            if (!testResponse.ok) {
                throw new Error('Server is not responding correctly');
            }
            
            // Save server configuration
            await fetch('/api/sync/configure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverUrl,
                    mode: 'cloud'
                })
            });
            
            // Success - show login
            showLoginView();
            
        } catch (error) {
            console.error('Connection error:', error);
            toast('error', 'Connection Failed', 'Could not connect to Zentrio Cloud. Please check your internet.');
        }
    }

    function showLoginView() {
        if (loginView) {
            loginView.style.display = 'block';
            // Force reflow
            void loginView.offsetWidth;
            loginView.classList.add('active');
            
            // Render the initial email form
            renderLoginForm('');
        }
    }

    // --- Auth Rendering Logic (Adapted from previous version) ---

    function renderBackButton(onClick) {
        if (!backBtnContainer) return;
        
        backBtnContainer.innerHTML = `
            <button id="globalBackBtn" class="zentrio-back-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Back
            </button>
        `;
        
        document.getElementById('globalBackBtn').addEventListener('click', onClick);
    }

    function clearBackButton() {
        if (backBtnContainer) backBtnContainer.innerHTML = '';
    }

    function renderLoginForm(email, nickname = null) {
        clearBackButton();
        
        inlineAuth.innerHTML = `
          <form id="emailForm" class="fade-in" novalidate>
            <div class="form-group">
              <label for="emailInput">Email</label>
              <input id="emailInput" type="email" value="${escapeHtml(email)}" placeholder="name@example.com" required />
            </div>
            <button type="submit" class="cta-button" style="width:100%">Continue</button>
            
            <div id="sso-container-placeholder"></div>
          </form>
        `;
        
        // Render SSO buttons below
        renderSSOButtons(document.getElementById('sso-container-placeholder'));

        const form = document.getElementById('emailForm');
        const emailInput = document.getElementById('emailInput');
        
        emailInput.focus();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailVal = emailInput.value.trim();
            if (!emailVal) {
                toast('warning', 'Email required', 'Please enter your email address.');
                return;
            }
            
            // Identify user
            const btn = form.querySelector('button');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Checking...';
            
            try {
                const res = await fetch('/api/auth/identify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailVal })
                });
                const data = await res.json();
                
                if (data.exists) {
                    renderPasswordForm(emailVal, data.nickname);
                } else {
                    renderRegisterForm(emailVal);
                }
            } catch (err) {
                console.error(err);
                toast('error', 'Error', 'Something went wrong. Please try again.');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    function renderPasswordForm(email, nickname) {
        renderBackButton(() => renderLoginForm(email));
        
        inlineAuth.innerHTML = `
          <form id="passwordForm" class="fade-in" novalidate>
            ${nickname ? `<div style="text-align:center;margin-bottom:16px;color:#fff;">Welcome back, <strong>${escapeHtml(nickname)}</strong></div>` : ''}
            
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input id="loginEmail" type="email" value="${escapeHtml(email)}" disabled style="opacity:0.7" />
            </div>
            
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <div class="password-input-container" style="position: relative; width: 100%;">
                <input id="loginPassword" type="password" placeholder="Enter your password" required />
              </div>
            </div>
            
            <div class="form-group remember-row">
              <label class="remember-checkbox" for="rememberMe">
                <input id="rememberMe" type="checkbox" />
                <span>Stay signed in</span>
              </label>
            </div>
            
            <button type="submit" class="cta-button" style="width:100%">Sign in</button>
            
            <div style="text-align:center;margin-top:16px;">
                <a href="#" id="forgotPasswordLink" style="color:#b3b3b3;text-decoration:underline;font-size:0.9rem;">Forgot Password?</a>
            </div>
          </form>
        `;
        
        const form = document.getElementById('passwordForm');
        const pwd = document.getElementById('loginPassword');
        const rememberEl = document.getElementById('rememberMe');
        
        if (rememberEl) {
            rememberEl.checked = getRememberPref();
            rememberEl.addEventListener('change', () => setRememberPref(rememberEl.checked));
        }
        
        pwd.focus();
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!pwd.value) return;
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Signing in...';
            
            try {
                const res = await fetch('/api/auth/sign-in/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password: pwd.value,
                        rememberMe: getRememberPref(),
                        callbackURL: window.__TAURI__ ? 'tauri://localhost' : '/profiles'
                    })
                });
                
                if (res.ok) {
                    toast('success', 'Signed in', 'Redirecting...');
                    setTimeout(() => { window.location.href = '/profiles'; }, 500);
                } else {
                    const data = await res.json();
                    toast('error', 'Sign in failed', data.message || 'Invalid credentials');
                    btn.disabled = false;
                    btn.textContent = 'Sign in';
                }
            } catch (err) {
                toast('error', 'Error', 'Network error');
                btn.disabled = false;
                btn.textContent = 'Sign in';
            }
        });
        
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            // Implement forgot password flow or toast
            toast('info', 'Forgot Password', 'Please contact support or use the magic link option if available.');
        });
    }

    function renderRegisterForm(email) {
        renderBackButton(() => renderLoginForm(email));
        
        inlineAuth.innerHTML = `
          <form id="registerForm" class="fade-in" novalidate>
            <div style="text-align:center;margin-bottom:16px;color:#fff;">Create an account</div>
            
            <div class="form-group">
              <label for="regEmail">Email</label>
              <input id="regEmail" type="email" value="${escapeHtml(email)}" disabled style="opacity:0.7" />
            </div>
            
            <div class="form-group">
              <label for="regUsername">Nickname</label>
              <input id="regUsername" type="text" placeholder="Nickname" required />
            </div>
            
            <div class="form-group">
              <label for="regPassword">Password</label>
              <input id="regPassword" type="password" placeholder="Create password (min 8 chars)" minlength="8" required />
            </div>
            
            <button type="submit" class="cta-button" style="width:100%">Create Account</button>
          </form>
        `;
        
        const form = document.getElementById('registerForm');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            
            if (password.length < 8) {
                toast('warning', 'Weak password', 'Password must be at least 8 characters');
                return;
            }
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating...';
            
            try {
                const res = await fetch('/api/auth/sign-up/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        name: username,
                        username,
                        rememberMe: true,
                        callbackURL: window.__TAURI__ ? 'tauri://localhost' : '/profiles'
                    })
                });
                
                if (res.ok) {
                    toast('success', 'Account created', 'Please verify your email if required.');
                    // Show verification message or redirect
                    inlineAuth.innerHTML = `
                        <div class="fade-in" style="text-align:center;">
                            <h3>Account Created!</h3>
                            <p>Please check your email for a verification link.</p>
                            <button class="cta-button" onclick="window.location.reload()">Back to Login</button>
                        </div>
                    `;
                } else {
                    const data = await res.json();
                    toast('error', 'Registration failed', data.message || 'Could not create account');
                    btn.disabled = false;
                    btn.textContent = 'Create Account';
                }
            } catch (err) {
                toast('error', 'Error', 'Network error');
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        });
    }

    function renderSSOButtons(container) {
        if (!container) return;
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;';
        
        const createBtn = (provider, iconName, label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sso-button';
            btn.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:10px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;color:white;transition:all 0.2s;';
            btn.innerHTML = `<span class="iconify" data-icon="mdi:${iconName}" data-inline="false" style="font-size: 20px;"></span> <span>${label}</span>`;
            
            btn.onmouseover = () => { btn.style.background = 'rgba(255,255,255,0.1)'; };
            btn.onmouseout = () => { btn.style.background = 'rgba(255,255,255,0.05)'; };
            
            btn.onclick = async () => {
                try {
                    if (window.__TAURI__) {
                        // Tauri specific handling for SSO
                        const { open } = window.__TAURI__.shell;
                        const res = await fetch('/api/auth/sign-in/social', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                provider,
                                callbackURL: 'zentrio://auth/callback' // Deep link for Tauri
                            })
                        });
                        const data = await res.json();
                        if (data.url) {
                            // Open in system browser
                            await open(data.url);
                        } else if (data.error) {
                            toast('error', 'Login failed', data.message || data.error);
                        }
                    } else {
                        // Web handling
                        const res = await fetch('/api/auth/sign-in/social', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                provider,
                                callbackURL: window.location.origin + '/profiles'
                            })
                        });
                        const data = await res.json();
                        if (data.url) {
                            window.location.href = data.url;
                        } else if (data.error) {
                            toast('error', 'Login failed', data.message || data.error);
                        }
                    }
                } catch (err) {
                    console.error('Social login error:', err);
                    toast('error', 'Login failed', 'Could not connect to server');
                }
            };
            return btn;
        };

        if (authProviders.google) wrapper.appendChild(createBtn('google', 'google', 'Google'));
        if (authProviders.github) wrapper.appendChild(createBtn('github', 'github', 'GitHub'));
        if (authProviders.discord) wrapper.appendChild(createBtn('discord', 'discord', 'Discord'));
        if (authProviders.oidc) wrapper.appendChild(createBtn('oidc', 'openid', authProviders.oidcName || 'OIDC'));

        if (wrapper.children.length > 0) {
            container.appendChild(wrapper);
        }
    }

    // Helpers
    function toast(type, title, message) {
        if (window.addToast) {
            window.addToast(type === 'success' ? 'message' : type, title, message);
        } else {
            console.log(`[${type}] ${title}: ${message}`);
            alert(`${title}: ${message}`);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function getRememberPref() {
        try { return localStorage.getItem('zentrioRememberMe') === 'true'; } catch (e) { return false; }
    }
    function setRememberPref(val) {
        try { localStorage.setItem('zentrioRememberMe', val ? 'true' : 'false'); } catch (e) {}
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();