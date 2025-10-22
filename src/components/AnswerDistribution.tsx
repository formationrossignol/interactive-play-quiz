import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnswerDistributionProps {
  answers: string[];
  distribution: number[]; // Percentage for each answer
  correctAnswer: number;
}

export const AnswerDistribution = ({ answers, distribution, correctAnswer }: AnswerDistributionProps) => {
  return (
    <Card className="bg-slate-900/85 border-slate-700/60 text-slate-100 shadow-2xl backdrop-blur">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-white mb-6 text-center">
          Répartition des réponses
        </h3>
        <div className="space-y-4">
          {answers.map((answer, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-slate-200 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{String.fromCharCode(65 + index)}.</span>
                  <span>{answer}</span>
                  {index === correctAnswer && (
                    <span className="text-success font-semibold">✓</span>
                  )}
                </div>
                <span className="font-bold">{distribution[index]}%</span>
              </div>
              <div className="bg-slate-800/60 rounded-full h-3 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-1000 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.35)]",
                    index === correctAnswer
                      ? "bg-success"
                      : "bg-primary/90"
                  )}
                  style={{
                    width: `${distribution[index]}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};