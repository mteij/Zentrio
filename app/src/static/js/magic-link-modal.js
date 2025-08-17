document.addEventListener('DOMContentLoaded', function () {
  const backBtn = document.getElementById('magicLinkBackBtn');
  const resendText = document.getElementById('resendMagicText');
  const messageBox = document.getElementById('magicLinkContainerMessage');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.history.back();
    });
  }

  if (resendText) {
    resendText.addEventListener('click', function () {
      // TODO: Implement resend magic link logic here
      messageBox.textContent = 'Resending magic link...';
      messageBox.className = 'message info';
      setTimeout(() => {
        messageBox.textContent = 'Magic link resent (demo)';
        messageBox.className = 'message success';
      }, 1000);
    });
  }
});