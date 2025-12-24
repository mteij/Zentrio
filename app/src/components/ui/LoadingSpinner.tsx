import { motion } from 'framer-motion'


interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ className = '', size = 'md' }: LoadingSpinnerProps) {
  const sizeConfig = {
    sm: { dot: 6, gap: 4 },
    md: { dot: 8, gap: 6 },
    lg: { dot: 10, gap: 8 }
  }

  const { dot: dotSize, gap } = sizeConfig[size]

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ gap: `${gap}px` }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: '#ef4444', // red-500
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  )
}

