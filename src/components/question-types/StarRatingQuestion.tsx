import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingQuestionProps {
  question: {
    question: string;
    maxStars: number;
  };
  onAnswer?: (rating: number) => void;
  showResults?: boolean;
  results?: Record<number, number>;
}

export const StarRatingQuestion = ({ question, onAnswer, showResults, results }: StarRatingQuestionProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);

  const handleRate = (value: number) => {
    setRating(value);
    onAnswer?.(value);
  };

  const total = results ? Object.values(results).reduce((a, b) => a + b, 0) : 0;
  const average = total > 0 
    ? Object.entries(results || {}).reduce((acc, [stars, count]) => acc + (parseInt(stars) * count), 0) / total
    : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white mb-6">{question.question}</h3>
      
      {!showResults ? (
        <div className="flex justify-center gap-2">
          {[...Array(question.maxStars)].map((_, index) => {
            const starValue = index + 1;
            return (
              <button
                key={starValue}
                onClick={() => handleRate(starValue)}
                onMouseEnter={() => setHover(starValue)}
                onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={48}
                  className={`${
                    starValue <= (hover || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-white/40"
                  } transition-colors`}
                />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-white text-3xl font-bold">{average.toFixed(1)} / {question.maxStars}</p>
            <p className="text-white/60">Note moyenne ({total} votes)</p>
          </div>
          <div className="space-y-2">
            {[...Array(question.maxStars)].reverse().map((_, index) => {
              const stars = question.maxStars - index;
              const count = results?.[stars] || 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={stars} className="flex items-center gap-4">
                  <div className="flex items-center gap-1 w-24">
                    <span className="text-white">{stars}</span>
                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-primary h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-white w-20 text-right">{count} ({percentage.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
