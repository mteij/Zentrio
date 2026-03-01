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
    <div
      className={fullScreen
        ? 'min-h-screen bg-[#141414] px-4 py-8 sm:py-10 flex items-center justify-center'
        : 'w-full px-4 py-6 sm:py-8 flex items-center justify-center'}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(25,25,25,0.92),rgba(15,15,15,0.96))] backdrop-blur-md p-5 sm:p-7 text-center shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
        <h2 className="m-0 text-white text-xl sm:text-2xl font-extrabold leading-tight">{title}</h2>
        <p className="mt-2 mb-0 text-white/70 text-[0.95rem] sm:text-[0.98rem] leading-6 sm:leading-7">{message}</p>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          {onRetry && (
            <Button className="w-full sm:w-auto" onClick={onRetry} disabled={isRetrying}>
              {isRetrying ? 'Retrying...' : retryLabel}
            </Button>
          )}

          {onBack && (
            <Button className="w-full sm:w-auto" variant="secondary" onClick={onBack}>
              {backLabel}
            </Button>
          )}
        </div>

        {showReportLink && (
          <p className="mt-4 mb-0 text-white/60 text-sm leading-6 text-balance">
            If this looks like a bug, please report it on{' '}
            <a
              href="https://github.com/mteij/zentrio"
              target="_blank"
              rel="noreferrer noopener"
              className="text-white font-semibold underline underline-offset-2 hover:text-red-300 transition-colors"
            >
              github.com/mteij/zentrio
            </a>
            .
          </p>
        )}
      </div>
    </div>
  )
}
