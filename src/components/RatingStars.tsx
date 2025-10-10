import { Star } from "lucide-react";

interface RatingStarsProps {
  rating: number;
  ratingCount?: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export const RatingStars = ({ 
  rating, 
  ratingCount, 
  onRate, 
  readonly = false,
  size = "md" 
}: RatingStarsProps) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => !readonly && onRate?.(star)}
            disabled={readonly}
            className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          >
            <Star
              className={`${sizeClasses[size]} ${
                star <= rating 
                  ? 'fill-yellow-400 text-yellow-400' 
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
      {ratingCount !== undefined && ratingCount > 0 && (
        <span className="text-xs text-muted-foreground">
          ({rating.toFixed(1)} • {ratingCount} {ratingCount === 1 ? 'note' : 'notes'})
        </span>
      )}
    </div>
  );
};
