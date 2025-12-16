import { Star } from 'lucide-react'

interface RatingBadgeProps {
    rating: number;
    className?: string;
    style?: React.CSSProperties;
}

export const RatingBadge = ({ rating, className = '', style = {} }: RatingBadgeProps) => {
    if (!rating || rating <= 0) return null;

    return (
        <div 
            className={`rating-badge ${className}`}
            style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                padding: '4px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                zIndex: 5,
                ...style
            }}
        >
            <Star size={14} fill="#f5c518" color="#f5c518" />
            <span>{rating.toFixed(1)}</span>
        </div>
    );
};