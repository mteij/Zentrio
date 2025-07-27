export const getSessionScript = (sessionData: string) => `
<script>
  let session; // Declare session in a wider scope
  // This script runs before Stremio's own scripts to set up the session.
  try {
    session = JSON.parse(decodeURIComponent(\`${encodeURIComponent(sessionData)}\`));
    console.log('Zentrio: Session object created successfully.', session);
    // Iterate over the session object and set each key in localStorage.
    // Stremio expects some values to be JSON.stringified (like strings), and others not (like numbers).
    for (const key in session) {
        const value = session[key];
        // Stremio expects all values to be stored as JSON strings.
        localStorage.setItem(key, JSON.stringify(value));
    }
    // Clean the URL in the browser's history.
    history.replaceState(null, '', '/stremio/');
  } catch (e) {
    console.error('Zentrio: Failed to inject session.', e);
  }

  // This observer removes the "Streaming server is not available" warning
  // and replaces the Stremio logo with the user's profile picture.
  const observer = new MutationObserver(() => {
    // Check for the warning and remove it.
    const warningLink = document.querySelector('a[href="https://www.stremio.com/download-service"]');
    if (warningLink) {
      const container = warningLink.closest('div[class*="board-warning-container"]');
      if (container) container.remove();
    }

    // Check for the logo and replace it.
    const logoImg = document.querySelector('img[src*="stremio_symbol.png"]');
    if (logoImg && session && session.profilePictureUrl) {
      const logoContainer = logoImg.closest('div[class*="logo-container"]');
      if (logoContainer && !logoContainer.querySelector('#zentrio-profile-link')) {
        const profilePicUrl = session.profilePictureUrl;
        logoContainer.innerHTML = \`
          <a id="zentrio-profile-link" href="#" title="Back to Profiles" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
            <img src="\${profilePicUrl}" alt="Profiles" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 2px #141414;" />
          </a>
        \`;
        const profileLink = logoContainer.querySelector('#zentrio-profile-link');
        if (profileLink) {
          profileLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
              const authKey = session?.profile?.auth?.key;
              if (authKey) {
                await fetch('/stremio/api/logout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'Logout', authKey: authKey })
                });
              }
            } catch (err) {
              console.error('Zentrio: Failed to logout.', err);
            } finally {
              window.top.location.href = '/profiles';
            }
          });
        }
      }
    }
    
    // Hide calendar buttons if setting is enabled
    if (session?.hideCalendarButton) {
      const hideCalendarButtons = () => {
        document.querySelectorAll('a[href="#/calendar"]').forEach(el => {
          el.style.display = 'none';
        });
      };

      // Initial hide
      hideCalendarButtons();

      // Set up MutationObserver to watch for dynamically added elements
      const observer = new MutationObserver(() => {
        hideCalendarButtons();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Hide addons buttons if setting is enabled
    if (session?.hideAddonsButton) {
      const hideAddonsButtons = () => {
        document.querySelectorAll('a[href="#/addons"]').forEach(el => {
          el.style.display = 'none';
        });
      };

      // Initial hide
      hideAddonsButtons();

      // Set up MutationObserver to watch for dynamically added elements
      const observer = new MutationObserver(() => {
        hideAddonsButtons();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  });

  // Run the observer as soon as the body is available.
  if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
  } else {
      document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, { childList: true, subtree: true });
      });
  }
</script>
`;