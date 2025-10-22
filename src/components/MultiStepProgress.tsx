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
            "h-2 flex-1 rounded-full transition-all duration-300 shadow-sm",
            index < currentStep
              ? "bg-primary/90 shadow-[0_0_12px_rgba(59,130,246,0.45)]"
              : index === currentStep
              ? "bg-gradient-to-r from-sky-400/90 via-primary to-indigo-500/90 animate-pulse shadow-[0_0_16px_rgba(56,189,248,0.55)]"
              : "bg-slate-600/50"
          )}
        />
      ))}
    </div>
  );
};
