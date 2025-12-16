import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  fullScreen?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ fullScreen = true, className = '', size = 'lg' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  }

  const spinner = (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className={`${sizeClasses[size]} border-purple-500/30 border-t-purple-500 rounded-full animate-spin`} />
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full bg-[#141414] flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}
