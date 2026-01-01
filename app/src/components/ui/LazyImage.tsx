import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  style?: any;
  priority?: boolean; // For above-fold images
  blurAmount?: number; // Blur amount for placeholder (default: 10px)
}

export const LazyImage = ({
  src,
  alt,
  className,
  placeholderColor = '#222',
  style,
  priority = false,
  blurAmount = 10
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Intersection Observer for lazy loading - observe the CONTAINER, not the img
  useEffect(() => {
    if (priority) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before element enters viewport
        threshold: 0.01
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
      observerRef.current = observer
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [priority])

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true)
  }

  // Handle image error
  const handleError = () => {
    setHasError(true)
    setIsLoaded(true) // Still mark as loaded to stop showing loading state
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        backgroundColor: placeholderColor,
        position: 'relative',
        overflow: 'hidden',
        minHeight: style?.height || '200px', // Default minimum height
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isInView && !hasError ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: style?.height || 'auto',
            objectFit: style?.height ? 'cover' : 'contain',
            display: 'block',
            filter: isLoaded ? 'none' : `blur(${blurAmount}px)`,
            transition: 'filter 0.3s ease-out',
            opacity: isLoaded ? 1 : 0.7,
          }}
        />
      ) : hasError ? (
        <div style={{
          color: '#666',
          fontSize: '0.875rem',
          padding: '1rem',
          textAlign: 'center'
        }}>
          {alt || 'Image not available'}
        </div>
      ) : null}
    </div>
  );
};
