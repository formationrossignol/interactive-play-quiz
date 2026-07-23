import { cn } from "@/lib/utils";

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  className?: string;
}

export const CircularTimer = ({ timeLeft, totalTime, className }: CircularTimerProps) => {
  const percentage = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const arcColor = percentage > 60 ? '#15c08a' : percentage > 30 ? '#ffb020' : '#ff5a4d';

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg className="transform -rotate-90" width="120" height="120">
        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="9"
          fill="rgba(0,0,0,0.15)"
        />
        {/* Progress arc — color shifts green→yellow→red */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={arcColor}
          strokeWidth="9"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn("text-3xl font-bold", percentage <= 30 && "animate-pulse")}
          style={{
            fontFamily: 'var(--ap-font-display)',
            color: arcColor,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
