import { cn } from "@/lib/utils";

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  className?: string;
}

export const CircularTimer = ({ timeLeft, totalTime, className }: CircularTimerProps) => {
  const percentage = (timeLeft / totalTime) * 100;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const isWarning = timeLeft <= 10;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg className="transform -rotate-90" width="120" height="120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-white/20"
        />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            "transition-all duration-1000 ease-linear",
            isWarning ? "text-warning animate-pulse" : "text-primary"
          )}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn(
          "text-3xl font-bold",
          isWarning ? "text-warning animate-pulse" : "text-white"
        )}>
          {timeLeft}
        </div>
      </div>
    </div>
  );
};