interface AnimatedBackgroundProps {
  className?: string
  image?: string
  fallbackColor?: string
  opacity?: number
  /** Enable floating orbs effect */
  showOrbs?: boolean
}

/**
 * Premium animated gradient background with floating orbs
 * Used for app pages (Profiles, Settings, Addons, etc.)
 */
export function AnimatedBackground({ 
  className = '', 
  image, 
  fallbackColor, 
  opacity = 1,
  showOrbs = true,
}: AnimatedBackgroundProps) {
  // Brand colors
  const colors = {
    primary: '#0a0a0a',
    accent: '#dc2626', // Zentrio red
  }

  if (image) {
    return (
      <div 
        className={`fixed inset-0 z-0 pointer-events-none ${className}`} 
        style={{ 
          top: 0, 
          height: '100vh', 
          background: fallbackColor || colors.primary 
        }}
      >
        <div 
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: opacity
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-2xl" />
      </div>
    )
  }

  return (
    <>
      {/* Main background */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none ${className}`}
        style={{
          top: 0,
          height: '100vh',
          background: colors.primary,
        }}
      >
        {/* Large red glow - top right */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.accent}25 0%, ${colors.accent}10 30%, transparent 70%)`,
            filter: 'blur(80px)',
            animation: 'pulseGlow 8s ease-in-out infinite',
          }}
        />
        
        {/* Medium red glow - bottom left */}
        <div
          className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.accent}20 0%, ${colors.accent}08 40%, transparent 70%)`,
            filter: 'blur(60px)',
            animation: 'pulseGlow 10s ease-in-out infinite reverse',
          }}
        />
        
        {/* Subtle center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.accent}08 0%, transparent 60%)`,
            filter: 'blur(100px)',
          }}
        />

        {showOrbs && (
          <>
            {/* Floating orb 1 */}
            <div
              className="absolute w-32 h-32 rounded-full"
              style={{
                top: '20%',
                right: '15%',
                background: `radial-gradient(circle, ${colors.accent}40 0%, transparent 70%)`,
                filter: 'blur(40px)',
                animation: 'floatOrb1 15s ease-in-out infinite',
              }}
            />
            
            {/* Floating orb 2 */}
            <div
              className="absolute w-24 h-24 rounded-full"
              style={{
                bottom: '30%',
                left: '10%',
                background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`,
                filter: 'blur(30px)',
                animation: 'floatOrb2 20s ease-in-out infinite',
              }}
            />
            
            {/* Floating orb 3 */}
            <div
              className="absolute w-16 h-16 rounded-full"
              style={{
                top: '60%',
                right: '30%',
                background: `radial-gradient(circle, ${colors.accent}35 0%, transparent 70%)`,
                filter: 'blur(25px)',
                animation: 'floatOrb3 12s ease-in-out infinite',
              }}
            />
          </>
        )}

        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '150px 150px',
          }}
        />
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes floatOrb1 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-40px, 30px);
          }
          50% {
            transform: translate(-20px, 60px);
          }
          75% {
            transform: translate(30px, 20px);
          }
        }

        @keyframes floatOrb2 {
          0%, 100% {
            transform: translate(0, 0);
          }
          33% {
            transform: translate(60px, -40px);
          }
          66% {
            transform: translate(30px, 40px);
          }
        }

        @keyframes floatOrb3 {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(-50px, -30px);
          }
        }
      `}</style>
    </>
  )
}
