import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TransitionTimerProps {
  duration: number;
  onComplete: () => void;
}

export const TransitionTimer = ({ duration, onComplete }: TransitionTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [timeLeft, onComplete]);

  const percentage = (timeLeft / duration) * 100;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-12 animate-fade-in">
          Préparez-vous pour la question suivante !
        </h1>

        <div className="relative inline-flex items-center justify-center">
          <svg className="transform -rotate-90" width="280" height="280">
            {/* Background circle */}
            <circle
              cx="140"
              cy="140"
              r={radius}
              stroke="currentColor"
              strokeWidth="16"
              fill="none"
              className="text-slate-700/60"
            />
            {/* Progress circle */}
            <circle
              cx="140"
              cy="140"
              r={radius}
              stroke="currentColor"
              strokeWidth="16"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-1000 ease-linear text-primary drop-shadow-[0_0_18px_rgba(59,130,246,0.55)]"
              )}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl font-bold text-white animate-pulse drop-shadow-lg">
              {timeLeft}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
