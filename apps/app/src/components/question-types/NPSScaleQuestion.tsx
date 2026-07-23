import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NPSScaleQuestionProps {
  question: string;
  minLabel?: string;
  maxLabel?: string;
  onAnswer: (value: number) => void;
}

export const NPSScaleQuestion = ({ 
  question, 
  minLabel = "Pas du tout probable",
  maxLabel = "Extrêmement probable",
  onAnswer 
}: NPSScaleQuestionProps) => {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (value: number) => {
    setSelected(value);
    onAnswer(value);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-8">{question}</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-11 gap-2">
          {Array.from({ length: 11 }, (_, i) => (
            <Button
              key={i}
              variant={selected === i ? "default" : "outline"}
              className={`h-16 text-lg font-bold transition-all ${
                selected === i 
                  ? "scale-110 shadow-lg" 
                  : "hover:scale-105"
              } ${
                i <= 6 
                  ? "hover:bg-red-100 hover:border-red-300" 
                  : i <= 8 
                  ? "hover:bg-yellow-100 hover:border-yellow-300" 
                  : "hover:bg-green-100 hover:border-green-300"
              }`}
              onClick={() => handleSelect(i)}
            >
              {i}
            </Button>
          ))}
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground px-2">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
      
      <div className="text-center text-sm text-muted-foreground mt-4">
        Sélectionnez une note de 0 à 10
      </div>
    </div>
  );
};
