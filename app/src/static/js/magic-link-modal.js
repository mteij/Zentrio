document.addEventListener('DOMContentLoaded', function () {
  const backBtn = document.getElementById('magicLinkBackBtn');
  const resendText = document.getElementById('resendMagicText');
  // Using toast notifications instead of inline messages

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.history.back();
    });
  }

  if (resendText) {
    resendText.addEventListener('click', function () {
      // TODO: Implement resend magic link logic here
      if (window.addToast) window.addToast('message', 'Resending magic link', 'Please wait...');
      setTimeout(() => {
        if (window.addToast) window.addToast('message', 'Magic link resent', '(demo)');
      }, 1000);
    });
  }
});