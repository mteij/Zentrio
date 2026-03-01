import { Button } from './Button'

interface LoadErrorStateProps {
  title?: string
  message?: string
  retryLabel?: string
  backLabel?: string
  onRetry?: () => void
  onBack?: () => void
  isRetrying?: boolean
  fullScreen?: boolean
  showReportLink?: boolean
}

export function LoadErrorState({
  title = 'Failed to load',
  message = 'Failed to load, try again.',
  retryLabel = 'Retry',
  backLabel = 'Go Back',
  onRetry,
  onBack,
  isRetrying = false,
  fullScreen = true,
  showReportLink = true
}: LoadErrorStateProps) {
  return (
    <>
      <style>{`
        .load-error-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          box-sizing: border-box;
        }
        .load-error-wrap.full-screen {
          min-height: 100dvh;
          background: #141414;
        }
        .load-error-card {
          width: 100%;
          max-width: 42rem;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(145deg, rgba(25,25,25,0.92), rgba(15,15,15,0.96));
          backdrop-filter: blur(12px);
          padding: 1.25rem;
          text-align: center;
          box-shadow: 0 18px 48px rgba(0,0,0,0.45);
        }
        .load-error-card h2 {
          margin: 0;
          color: #fff;
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .load-error-card .msg {
          margin: 0.5rem 0 0;
          color: rgba(255,255,255,0.7);
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .load-error-actions {
          margin-top: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          gap: 0.75rem;
        }
        .load-error-report {
          margin: 1rem 0 0;
          color: rgba(255,255,255,0.6);
          font-size: 0.875rem;
          line-height: 1.5;
          text-wrap: balance;
        }
        .load-error-report a {
          color: #fff;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.2s;
        }
        .load-error-report a:hover {
          color: #fca5a5;
        }

        /* Tablet+ */
        @media (min-width: 640px) {
          .load-error-wrap { padding: 2.5rem 1rem; }
          .load-error-card { padding: 1.75rem; }
          .load-error-card h2 { font-size: 1.5rem; }
          .load-error-card .msg { font-size: 0.98rem; line-height: 1.75; }
          .load-error-actions {
            flex-direction: row;
            align-items: center;
          }
          .load-error-actions button { width: auto; }
        }

        /* Mobile landscape – compact horizontal layout */
        @media (orientation: landscape) and (max-height: 500px) {
          .load-error-wrap { padding: 0.75rem 1rem; }
          .load-error-card {
            max-width: 32rem;
            padding: 1rem 1.25rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem 1rem;
            text-align: left;
          }
          .load-error-text {
            flex: 1 1 0;
            min-width: 0;
          }
          .load-error-card h2 { font-size: 1rem; }
          .load-error-card .msg { font-size: 0.85rem; margin-top: 0.25rem; line-height: 1.3; }
          .load-error-actions {
            margin-top: 0;
            flex-direction: row;
            flex-shrink: 0;
            gap: 0.5rem;
          }
          .load-error-actions button { width: auto; font-size: 0.85rem; padding: 0.4rem 0.9rem; }
          .load-error-report {
            width: 100%;
            margin-top: 0.5rem;
            font-size: 0.75rem;
            text-align: center;
          }
        }
      `}</style>
      <div className={`load-error-wrap${fullScreen ? ' full-screen' : ''}`}>
        <div className="load-error-card">
          <div className="load-error-text">
            <h2>{title}</h2>
            <p className="msg">{message}</p>
          </div>

          <div className="load-error-actions">
            {onRetry && (
              <Button onClick={onRetry} disabled={isRetrying}>
                {isRetrying ? 'Retrying...' : retryLabel}
              </Button>
            )}
            {onBack && (
              <Button variant="secondary" onClick={onBack}>
                {backLabel}
              </Button>
            )}
          </div>

          {showReportLink && (
            <p className="load-error-report">
              If this looks like a bug, please report it on{' '}
              <a
                href="https://github.com/mteij/zentrio"
                target="_blank"
                rel="noreferrer noopener"
              >
                github.com/mteij/zentrio
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </>
  )
}
