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
  const isWarning = timeLeft <= 5;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg className="transform -rotate-90" width="120" height="120">
        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="9"
          fill="rgba(0,0,0,0.15)"
        />
        {/* Progress — always white so it's visible on any themed background */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={isWarning ? '#ffb020' : 'rgba(255,255,255,0.95)'}
          strokeWidth="9"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn("text-3xl font-bold", isWarning && "animate-pulse")}
          style={{
            fontFamily: 'var(--ap-font-display)',
            color: isWarning ? '#ffb020' : 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
