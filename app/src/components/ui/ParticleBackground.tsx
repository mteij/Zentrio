import { useEffect, useRef } from 'react';

interface ParticleBackgroundProps {
  /** Base color for particles in RGB format, defaults to red (220, 38, 38) */
  color?: [number, number, number];
  /** Particle density - lower = more particles. Default 15000 */
  density?: number;
  /** Max connection distance between particles. Default 100 */
  connectionDistance?: number;
  /** Whether to show gradient background. Default true */
  showGradient?: boolean;
  /** Seed for consistent particle positions across pages */
  seed?: number;
}

// Simple seeded random number generator for consistent particle positions
function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Animated particle background with connecting lines
 * Used in onboarding wizard and auth pages
 */
export function ParticleBackground({ 
  color = [220, 38, 38], 
  density = 15000,
  connectionDistance = 100,
  showGradient = true,
  seed = 12345,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
  }>>([]);
  const initializedRef = useRef(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    const particles = particlesRef.current;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    const createParticles = () => {
      // Only create particles once with seeded positions
      if (initializedRef.current && particles.length > 0) return;
      
      particles.length = 0;
      const random = seededRandom(seed);
      const count = Math.floor((window.innerWidth * window.innerHeight) / density);
      
      for (let i = 0; i < count; i++) {
        particles.push({
          x: random() * window.innerWidth,
          y: random() * window.innerHeight,
          vx: (random() - 0.5) * 0.3,
          vy: (random() - 0.5) * 0.3,
          size: random() * 2 + 0.5,
          opacity: random() * 0.4 + 0.1,
        });
      }
      initializedRef.current = true;
    };
    
    const [r, g, b] = color;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
        ctx.fill();
      });
      
      // Draw connections (limit to improve performance)
      const maxConnections = 50;
      let connections = 0;
      
      for (let i = 0; i < particles.length && connections < maxConnections; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length && connections < maxConnections; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 * (1 - dist / connectionDistance)})`;
            ctx.stroke();
            connections++;
          }
        }
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    resize();
    createParticles();
    animate();
    
    const handleResize = () => {
      resize();
      // Don't recreate particles on resize, just adjust positions
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [color, density, connectionDistance, seed]);
  
  const gradientStyle = showGradient 
    ? { background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)' }
    : {};
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
      style={gradientStyle}
    />
  );
}

export default ParticleBackground;
