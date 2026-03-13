import React from 'react'

interface CircularProgressProps {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  showText?: boolean
  className?: string
}

export function CircularProgress({
  progress,
  size = 40,
  strokeWidth = 4,
  color = '#a855f7', // Zentrio purple
  trackColor = 'rgba(255, 255, 255, 0.1)',
  showText = true,
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const safeProgress = Math.max(0, Math.min(100, progress))
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference

  return (
    <div 
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease-in-out'
          }}
        />
      </svg>
      {showText && (
        <span style={{
          position: 'absolute',
          fontSize: size * 0.25,
          fontWeight: 600,
          color: '#fff',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {Math.round(safeProgress)}%
        </span>
      )}
    </div>
  )
}
