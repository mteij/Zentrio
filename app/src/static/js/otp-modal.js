document.addEventListener('DOMContentLoaded', function () {
  const backBtn = document.getElementById('otpBackBtn');
  const verifyBtn = document.getElementById('verifyOtpCodeBtn');
  const resendText = document.getElementById('resendOtpText');
  const codeInput = document.getElementById('otpCodeInput');
  // Using toast notifications instead of inline messages

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.history.back();
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', function () {
      const code = codeInput.value.trim();
      if (code.length !== 6) {
        window.addToast && window.addToast('error', 'Invalid code', 'Please enter a valid 6-digit code.');
        return;
      }
      // TODO: Implement actual OTP verification logic here
      window.addToast && window.addToast('message', 'Verifying', 'Please wait...');
      setTimeout(() => {
        window.addToast && window.addToast('message', 'OTP verified', '(demo)');
      }, 1000);
    });
  }

  if (resendText) {
    resendText.addEventListener('click', function () {
      // TODO: Implement resend OTP logic here
      window.addToast && window.addToast('message', 'Resending OTP', 'Please wait...');
      setTimeout(() => {
        window.addToast && window.addToast('message', 'OTP resent', '(demo)');
      }, 1000);
    });
  }
});