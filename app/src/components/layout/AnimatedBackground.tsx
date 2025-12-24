import { useEffect, useState } from 'react'

interface AnimatedBackgroundProps {
  className?: string
  image?: string
  fallbackColor?: string
  opacity?: number
}

/**
 * Pure CSS animated gradient background - replaces Vanta.js
 * ~10KB vs ~100KB, hardware accelerated, zero layout shifts
 */
export function AnimatedBackground({ className = '', image, fallbackColor, opacity = 1 }: AnimatedBackgroundProps) {
  // Hardcoded Zentrio Theme Colors
  const colors = {
    primary: '#101010',
    secondary: '#1a1a1a', 
    tertiary: '#252525'
  }
  const speed = 45

  if (image) {
      return (
        <div className={`fixed inset-0 z-0 pointer-events-none ${className}`} style={{ top: 'var(--titlebar-height, 0px)', height: 'var(--app-height, 100vh)', background: fallbackColor || colors.primary }}>
            <div 
                className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
                style={{
                    backgroundImage: `url(${image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: opacity
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />
        </div>
      )
  }

  return (
    <>
      {/* Main animated gradient background */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none ${className}`}
        style={{
          top: 'var(--titlebar-height, 0px)',
          height: 'var(--app-height, 100vh)',
          backgroundImage: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`,
          backgroundSize: '400% 400%',
          backgroundPosition: 'center',
          animation: `backgroundPan ${speed}s ease infinite`
        }}
      >
        {/* Animated gradient overlay */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, ${colors.primary}40 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, ${colors.secondary}30 0%, transparent 50%),
              radial-gradient(circle at 40% 20%, ${colors.tertiary}20 0%, transparent 50%)
            `,
            animation: `gradientShift ${speed * 0.75}s ease infinite`
          }}
        />

        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px'
          }}
        />

        {/* Radial gradient vignette */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
          }}
        />
      </div>

      {/* Keyframe animation inline styles */}
      <style>{`
        @keyframes backgroundPan {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            opacity: 0.7;
            transform: translate(0, 0) scale(1);
          }
          33% {
            opacity: 0.6;
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            opacity: 0.8;
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
      `}</style>
    </>
  )
}

/**
 * Example usage:
 * 
 * <AnimatedBackground variant="zentrio" />
 * <AnimatedBackground variant="purple" />
 * <AnimatedBackground variant="blue" />
 */
