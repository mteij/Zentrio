import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  fullScreen?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ fullScreen = true, className = '', size = 'md' }: LoadingSpinnerProps) {
  const sizeConfig = {
    sm: { dot: 6, gap: 4 },
    md: { dot: 8, gap: 6 },
    lg: { dot: 10, gap: 8 }
  }

  const { dot: dotSize, gap } = sizeConfig[size]

  const spinner = (
    <div className={`flex items-center justify-center ${className}`} style={{ gap: `${gap}px` }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(139, 92, 246, 0.7))',
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.5)'
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  )

  if (fullScreen) {
    return (
      <div 
        className="min-h-screen w-full flex items-center justify-center z-50"
        style={{ 
          background: 'linear-gradient(180deg, #0a0a0a 0%, #141414 100%)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            padding: '24px 32px',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          {spinner}
        </motion.div>
      </div>
    )
  }

  return spinner
}

