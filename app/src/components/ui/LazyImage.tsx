interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  style?: any;
}

export const LazyImage = ({ src, alt, className, placeholderColor = '#222', style }: LazyImageProps) => {
  return (
    <div
      className={className}
      style={{
        ...style,
        backgroundColor: placeholderColor,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block'
        }}
      />
    </div>
  );
};