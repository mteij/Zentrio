import { SimpleLayout, Button, FormGroup, Input } from '../components/index'

interface TauriSetupPageProps {}

export function TauriSetupPage({}: TauriSetupPageProps) {
  return (
    <SimpleLayout title="Welcome to Zentrio">
      <div id="zentrio-vanta-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}></div>
      <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: '600px' }}>
        <div className="setup-card">
          <div className="setup-header">
            <h1>Welcome to Zentrio</h1>
            <p>Choose how you'd like to use Zentrio:</p>
          </div>

          <div className="setup-options">
            {/* Option 1: Public Instance */}
            <div className="setup-option" id="public-option">
              <div className="option-header">
                <div className="option-icon">🌐</div>
                <div className="option-info">
                  <h3>Use Public Instance</h3>
                  <p>Connect to zentrio.eu for a quick start with cloud sync</p>
                </div>
              </div>
              <Button variant="primary" id="selectPublicBtn" className="option-button">
                Use Public Instance
              </Button>
            </div>

            {/* Option 2: Self-Hosted */}
            <div className="setup-option" id="selfhosted-option">
              <div className="option-header">
                <div className="option-icon">🏠</div>
                <div className="option-info">
                  <h3>Self-Hosted Instance</h3>
                  <p>Connect to your own Zentrio server</p>
                </div>
              </div>
              <div className="selfhosted-form" id="selfhosted-form" style={{ display: 'none' }}>
                <FormGroup label="Server URL" htmlFor="serverUrl">
                  <Input
                    type="text"
                    id="serverUrl"
                    placeholder="https://your-zentrio-server.com"
                    value="https://zentrio.eu"
                  />
                </FormGroup>
                <div className="form-actions">
                  <Button variant="secondary" id="backToOptionsBtn">
                    Back
                  </Button>
                  <Button variant="primary" id="connectSelfHostedBtn">
                    Connect
                  </Button>
                </div>
              </div>
              <Button variant="secondary" id="selectSelfHostedBtn" className="option-button">
                Use Self-Hosted
              </Button>
            </div>
          </div>

          <div className="setup-progress" id="setup-progress" style={{ display: 'none' }}>
            <div className="progress-header">
              <h3>Connecting to server...</h3>
              <p id="progress-message">Please wait while we set up your connection.</p>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" id="progress-fill"></div>
            </div>
            <div className="progress-actions">
              <Button variant="secondary" id="cancelSetupBtn" style={{ display: 'none' }}>
                Cancel
              </Button>
            </div>
          </div>

          <div className="setup-error" id="setup-error" style={{ display: 'none' }}>
            <div className="error-icon">⚠️</div>
            <div className="error-content">
              <h3>Connection Failed</h3>
              <p id="error-message">Unable to connect to the server. Please check your URL and try again.</p>
            </div>
            <div className="error-actions">
              <Button variant="secondary" id="retryConnectionBtn">
                Try Again
              </Button>
              <Button variant="secondary" id="backToSetupBtn">
                Back to Options
              </Button>
            </div>
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              let selectedMode = null;
              let isConnecting = false;

              // DOM elements
              const publicOption = document.getElementById('public-option');
              const selfHostedOption = document.getElementById('selfhosted-option');
              const selfHostedForm = document.getElementById('selfhosted-form');
              const setupProgress = document.getElementById('setup-progress');
              const setupError = document.getElementById('setup-error');

              // Buttons
              const selectPublicBtn = document.getElementById('selectPublicBtn');
              const selectSelfHostedBtn = document.getElementById('selectSelfHostedBtn');
              const backToOptionsBtn = document.getElementById('backToOptionsBtn');
              const connectSelfHostedBtn = document.getElementById('connectSelfHostedBtn');
              const cancelSetupBtn = document.getElementById('cancelSetupBtn');
              const retryConnectionBtn = document.getElementById('retryConnectionBtn');
              const backToSetupBtn = document.getElementById('backToSetupBtn');

              // Progress elements
              const progressMessage = document.getElementById('progress-message');
              const progressFill = document.getElementById('progress-fill');
              const errorMessage = document.getElementById('error-message');

              // Initialize
              async function init() {
                // Check if already configured
                try {
                  const response = await fetch('/api/sync/config');
                  if (response.ok) {
                    const config = await response.json();
                    if (config.isConnected || config.mode === 'cloud') {
                      // Already configured, redirect to profiles
                      window.location.href = '/profiles';
                      return;
                    }
                  }
                } catch (error) {
                  console.log('No existing configuration found');
                }
                
                // Hide all options initially
                showOptions();
                
                // Event listeners
                selectPublicBtn.addEventListener('click', () => selectMode('public'));
                selectSelfHostedBtn.addEventListener('click', () => selectMode('selfhosted'));
                backToOptionsBtn.addEventListener('click', showOptions);
                connectSelfHostedBtn.addEventListener('click', connectSelfHosted);
                cancelSetupBtn.addEventListener('click', cancelSetup);
                retryConnectionBtn.addEventListener('click', retryConnection);
                backToSetupBtn.addEventListener('click', showOptions);
              }

              function showOptions() {
                selectedMode = null;
                isConnecting = false;
                
                // Show options
                publicOption.style.display = 'flex';
                selfHostedOption.style.display = 'flex';
                
                // Hide forms and progress
                selfHostedForm.style.display = 'none';
                setupProgress.style.display = 'none';
                setupError.style.display = 'none';
                
                // Reset buttons
                selectSelfHostedBtn.style.display = 'block';
              }

              function selectMode(mode) {
                selectedMode = mode;
                
                // Hide all options
                publicOption.style.display = 'none';
                selfHostedOption.style.display = 'none';
                
                if (mode === 'selfhosted') {
                  // Show self-hosted form
                  selfHostedOption.style.display = 'flex';
                  selfHostedForm.style.display = 'block';
                  selectSelfHostedBtn.style.display = 'none';
                  document.getElementById('serverUrl').focus();
                } else if (mode === 'public') {
                  // Connect to public instance
                  connectToServer('https://zentrio.eu');
                }
              }

              function connectSelfHosted() {
                const serverUrl = document.getElementById('serverUrl').value.trim();
                if (!serverUrl) {
                  showError('Please enter a server URL');
                  return;
                }
                
                // Validate URL format
                try {
                  new URL(serverUrl);
                } catch {
                  showError('Please enter a valid URL (e.g., https://your-server.com)');
                  return;
                }
                
                connectToServer(serverUrl);
              }

              async function connectToServer(serverUrl) {
                isConnecting = true;
                showProgress();
                
                try {
                  updateProgress('Testing connection...');
                  
                  // Test server connectivity
                  const testResponse = await fetch(\`\${serverUrl}/api/auth/providers\`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                  });
                  
                  if (!testResponse.ok) {
                    throw new Error('Server is not responding correctly');
                  }
                  
                  updateProgress('Configuring sync settings...');
                  
                  // Save server configuration
                  await fetch('/api/sync/configure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      serverUrl,
                      mode: 'cloud'
                    })
                  });
                  
                  updateProgress('Finalizing setup...');
                  
                  // Wait a moment for visual feedback
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Redirect to profiles page
                  window.location.href = '/profiles';
                  
                } catch (error) {
                  console.error('Connection error:', error);
                  let errorMsg = 'Failed to connect to server';
                  
                  if (error.name === 'AbortError') {
                    errorMsg = 'Connection timed out. Please check the server URL and your internet connection.';
                  } else if (error.message.includes('fetch')) {
                    errorMsg = 'Unable to reach the server. Please check the URL and ensure the server is running.';
                  }
                  
                  showError(errorMsg);
                }
              }

              function showProgress() {
                // Hide options and error
                publicOption.style.display = 'none';
                selfHostedOption.style.display = 'none';
                setupError.style.display = 'none';
                
                // Show progress
                setupProgress.style.display = 'block';
                progressFill.style.width = '0%';
                
                // Start progress animation
                setTimeout(() => {
                  progressFill.style.width = '60%';
                }, 100);
              }

              function updateProgress(message) {
                progressMessage.textContent = message;
              }

              function showError(message) {
                isConnecting = false;
                
                // Hide options and progress
                publicOption.style.display = 'none';
                selfHostedOption.style.display = 'none';
                setupProgress.style.display = 'none';
                
                // Show error
                setupError.style.display = 'block';
                errorMessage.textContent = message;
              }

              function cancelSetup() {
                if (confirm('Are you sure you want to cancel the setup?')) {
                  showOptions();
                }
              }

              function retryConnection() {
                if (selectedMode === 'public') {
                  connectToServer('https://zentrio.eu');
                } else if (selectedMode === 'selfhosted') {
                  connectSelfHosted();
                }
              }

              // Initialize when DOM is ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
              } else {
                init();
              }
            })();
          `
        }}
      />

      <style>{`
        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }

        .setup-card {
          background: rgba(20, 20, 20, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .setup-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .setup-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .setup-header h1 {
          font-size: 32px;
          margin-bottom: 10px;
          color: var(--accent, #e50914);
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .setup-header p {
          color: var(--muted, #b3b3b3);
          font-size: 16px;
          line-height: 1.5;
        }

        .setup-options {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .setup-option {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .setup-option::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .setup-option:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .setup-option:hover::before {
          opacity: 1;
        }

        .option-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
          position: relative;
          z-index: 1;
        }

        .option-icon {
          font-size: 32px;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .option-info h3 {
          font-size: 18px;
          margin-bottom: 5px;
          color: white;
          font-weight: 600;
        }

        .option-info p {
          color: var(--muted, #b3b3b3);
          font-size: 14px;
          margin: 0;
          line-height: 1.4;
        }

        .option-button {
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .selfhosted-form {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          z-index: 1;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .form-actions .btn {
          flex: 1;
        }

        .setup-progress {
          text-align: center;
          padding: 40px 20px;
        }

        .progress-header h3 {
          font-size: 24px;
          margin-bottom: 10px;
          color: white;
          font-weight: 600;
        }

        .progress-header p {
          color: var(--muted, #b3b3b3);
          margin-bottom: 30px;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 30px;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent, #e50914);
          border-radius: 2px;
          transition: width 0.3s ease;
          width: 0%;
          box-shadow: 0 0 10px rgba(229, 9, 20, 0.5);
        }

        .setup-error {
          text-align: center;
          padding: 40px 20px;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .error-content h3 {
          font-size: 24px;
          margin-bottom: 10px;
          color: #ef4444;
        }

        .error-content p {
          color: var(--muted, #b3b3b3);
          margin-bottom: 30px;
          line-height: 1.5;
        }

        .error-actions {
          display: flex;
          gap: 10px;
        }

        .error-actions .btn {
          flex: 1;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent, #e50914);
          color: white;
          box-shadow: 0 4px 15px rgba(229, 9, 20, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--btn-primary-bg-hover, #f40612);
          box-shadow: 0 6px 20px rgba(229, 9, 20, 0.4);
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--muted, #b3b3b3);
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 14px;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent, #e50914);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 2px rgba(229, 9, 20, 0.2);
        }

        .form-group input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        @media (max-width: 640px) {
          .setup-card {
            padding: 30px 20px;
          }

          .setup-header h1 {
            font-size: 28px;
          }

          .option-header {
            gap: 12px;
          }

          .option-icon {
            font-size: 28px;
            width: 45px;
            height: 45px;
          }

          .form-actions {
            flex-direction: column;
          }

          .error-actions {
            flex-direction: column;
          }
        }
      `}</style>

      {/* Vanta.js background */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', () => {
              if (window.VANTA && window.VANTA.FOG) {
                VANTA.FOG({
                  el: "#zentrio-vanta-bg",
                  mouseControls: true,
                  touchControls: true,
                  gyroControls: false,
                  minHeight: 200.00,
                  minWidth: 200.00,
                  scale: 1.00,
                  scaleMobile: 1.00,
                  speed: 0.5,
                  zoom: 0.3
                });
              }
            });
          `
        }}
      />
    </SimpleLayout>
  )
}