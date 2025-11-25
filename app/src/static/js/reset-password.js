(function () {
    const form = document.getElementById('resetPasswordForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');
    const messageEl = document.getElementById('message');

    // Toast helper
    function toast(type, title, message) {
        if (window.addToast) {
            window.addToast(type, title, message);
        } else {
            alert(`${title}: ${message}`);
        }
    }

    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        toast('error', 'Invalid Link', 'Missing reset token.');
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    if (form) {
        // Initialize password toggles
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

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (password.length < 8) {
                toast('warning', 'Weak Password', 'Password must be at least 8 characters.');
                return;
            }

            if (password !== confirmPassword) {
                toast('warning', 'Mismatch', 'Passwords do not match.');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Resetting...';

                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        newPassword: password,
                        token
                    })
                });

                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    toast('success', 'Success', 'Password reset successfully. Redirecting...');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    toast('error', 'Failed', data.message || data.error || 'Failed to reset password.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Reset Password';
                }
            } catch (err) {
                toast('error', 'Error', 'Network error. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reset Password';
            }
        });
    }
})();