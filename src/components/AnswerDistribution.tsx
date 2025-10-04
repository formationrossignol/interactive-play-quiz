import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnswerDistributionProps {
  answers: string[];
  distribution: number[]; // Percentage for each answer
  correctAnswer: number;
}

export const AnswerDistribution = ({ answers, distribution, correctAnswer }: AnswerDistributionProps) => {
  const maxCount = Math.max(...distribution);

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-white mb-6 text-center">
          Répartition des réponses
        </h3>
        <div className="space-y-4">
          {answers.map((answer, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{String.fromCharCode(65 + index)}.</span>
                  <span>{answer}</span>
                  {index === correctAnswer && (
                    <span className="text-success">✓</span>
                  )}
                </div>
                <span className="font-bold">{distribution[index]}%</span>
              </div>
              <div className="bg-white/10 rounded-full h-3 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-1000 rounded-full",
                    index === correctAnswer
                      ? "bg-success"
                      : "bg-primary"
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