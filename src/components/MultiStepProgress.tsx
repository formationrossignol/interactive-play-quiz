import { cn } from "@/lib/utils";

interface MultiStepProgressProps {
  totalSteps: number;
  currentStep: number;
  className?: string;
}

export const MultiStepProgress = ({ totalSteps, currentStep, className }: MultiStepProgressProps) => {
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-2 flex-1 rounded-full transition-all duration-300",
            index < currentStep
              ? "bg-primary"
              : index === currentStep
              ? "bg-primary/70 animate-pulse"
              : "bg-white/20"
          )}
        />
      ))}
    </div>
  );
};
