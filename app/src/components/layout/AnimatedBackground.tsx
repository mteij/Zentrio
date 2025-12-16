import { useEffect, useState } from 'react'

interface AnimatedBackgroundProps {
  variant?: 'zentrio' | 'purple' | 'blue' | 'red' | 'green' | 'custom'
  className?: string
}

/**
 * Pure CSS animated gradient background - replaces Vanta.js
 * ~10KB vs ~100KB, hardware accelerated, zero layout shifts
 */
export function AnimatedBackground({ variant = 'zentrio', className = '' }: AnimatedBackgroundProps) {
  const [colors, setColors] = useState<{ primary: string; secondary: string; tertiary: string }>({
    primary: '#0a0a0a',
    secondary: '#141414',
    tertiary: '#000000'
  })
  const [speed, setSpeed] = useState(45)

  useEffect(() => {
    // Read theme from localStorage if available
    try {
      const themeConfig = localStorage.getItem('zentrioActiveThemeConfig')
      if (themeConfig && variant === 'zentrio') {
        const theme = JSON.parse(themeConfig)
        
        // precise speed from theme or default slow
        if (theme.animationSpeed) {
            setSpeed(theme.animationSpeed)
        }
        
        // Use explicit background colors if available
        if (theme.background) {
          setColors({
            primary: theme.background.primary || '#0a0a0a',
            secondary: theme.background.secondary || '#141414',
            tertiary: theme.background.tertiary || '#1a1a1a'
          })
          return
        }
        // Otherwise use accent color to create subtle gradient
        const accent = theme.accent || '#ffffff'
        setColors({
          primary: '#0a0a0a',
          secondary: '#141414', 
          tertiary: `${accent}08` // Very subtle accent tint
        })
        return
      }
    } catch (e) {
      console.error('Failed to load theme config', e)
    }

    // Fallback to variant presets
    const presets = {
      zentrio: {
        primary: '#101010',
        secondary: '#1a1a1a',
        tertiary: '#252525' // More visible white undertone
      },
      purple: {
        primary: '#2d1b69',
        secondary: '#1a0f3d',
        tertiary: '#0d0620'
      },
      blue: {
        primary: '#0f2027',
        secondary: '#203a43',
        tertiary: '#2c5364'
      },
      red: {
        primary: '#4a0e0e',
        secondary: '#2d0a0a',
        tertiary: '#1a0505'
      },
      green: {
        primary: '#0a3d2d',
        secondary: '#0d2620',
        tertiary: '#051a13'
      },
      custom: colors // Use current state
    }

    if (variant !== 'custom') {
      setColors(presets[variant])
    }
  }, [variant])

  // Listen for live theme updates
  useEffect(() => {
    if (variant !== 'zentrio') return

    const handleThemeUpdate = (e: CustomEvent) => {
      const theme = e.detail
      
      if (theme?.animationSpeed) {
          setSpeed(theme.animationSpeed)
      }
      
      if (theme && theme.background) {
        setColors({
          primary: theme.background.primary || '#0a0a0a',
          secondary: theme.background.secondary || '#141414',
          tertiary: theme.background.tertiary || '#1a1a1a'
        })
      } else if (theme) {
         // Fallback if background missing
         const accent = theme.accent || '#ffffff'
         setColors({
           primary: '#0a0a0a',
           secondary: '#141414', 
           tertiary: `${accent}08`
         })
      }
    }

    window.addEventListener('zentrio-theme-update', handleThemeUpdate as EventListener)
    return () => {
      window.removeEventListener('zentrio-theme-update', handleThemeUpdate as EventListener)
    }
  }, [variant])

  return (
    <>
      {/* Main animated gradient background */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none ${className}`}
        style={{
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
