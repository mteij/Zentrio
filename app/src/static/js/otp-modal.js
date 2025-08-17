document.addEventListener('DOMContentLoaded', function () {
  const backBtn = document.getElementById('otpBackBtn');
  const verifyBtn = document.getElementById('verifyOtpCodeBtn');
  const resendText = document.getElementById('resendOtpText');
  const codeInput = document.getElementById('otpCodeInput');
  const messageBox = document.getElementById('otpContainerMessage');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.history.back();
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', function () {
      const code = codeInput.value.trim();
      if (code.length !== 6) {
        messageBox.textContent = 'Please enter a valid 6-digit code.';
        messageBox.className = 'message error';
        return;
      }
      // TODO: Implement actual OTP verification logic here
      messageBox.textContent = 'Verifying...';
      messageBox.className = 'message info';
      setTimeout(() => {
        messageBox.textContent = 'OTP verified (demo)';
        messageBox.className = 'message success';
      }, 1000);
    });
  }

  if (resendText) {
    resendText.addEventListener('click', function () {
      // TODO: Implement resend OTP logic here
      messageBox.textContent = 'Resending OTP...';
      messageBox.className = 'message info';
      setTimeout(() => {
        messageBox.textContent = 'OTP resent (demo)';
        messageBox.className = 'message success';
      }, 1000);
    });
  }
});