import { cn } from "@/lib/utils";

interface MultiStepProgressProps {
  totalSteps: number;
  currentStep: number;
  className?: string;
}

/**
 * Barre de progression segmentée, lisible sur tous les fonds de l'app
 * (crème Arcade Pop, violet joueur, thèmes sombres de session) :
 * fait = vert --ap-pres, en cours = jaune --ap-flash pulsé, à venir = neutre.
 */
export const MultiStepProgress = ({ totalSteps, currentStep, className }: MultiStepProgressProps) => {
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-2 flex-1 rounded-full transition-all duration-300",
            index === currentStep && "animate-pulse"
          )}
          style={{
            background:
              index < currentStep
                ? "var(--ap-pres)"
                : index === currentStep
                ? "var(--ap-flash)"
                : "rgba(128,128,128,0.35)",
            boxShadow:
              index < currentStep
                ? "0 0 10px rgba(21,192,138,0.4)"
                : index === currentStep
                ? "0 0 12px rgba(255,176,32,0.5)"
                : "none",
          }}
        />
      ))}
    </div>
  );
};
