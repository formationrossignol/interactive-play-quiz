import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface SliderQuestionProps {
  question: string;
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  onAnswer: (value: number) => void;
}

export const SliderQuestion = ({ 
  question, 
  min,
  max,
  step,
  minLabel,
  maxLabel,
  onAnswer 
}: SliderQuestionProps) => {
  const [value, setValue] = useState<number>(Math.floor((min + max) / 2));
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onAnswer(value);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-center mb-8">{question}</h2>
      
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="text-5xl font-bold text-primary mb-4">
            {value}
          </div>
        </div>
        
        <Slider
          value={[value]}
          onValueChange={(vals) => setValue(vals[0])}
          min={min}
          max={max}
          step={step}
          className="py-4"
          disabled={submitted}
        />
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{minLabel || min}</span>
          <span>{maxLabel || max}</span>
        </div>
        
        {!submitted && (
          <div className="text-center pt-4">
            <Button onClick={handleSubmit} size="lg">
              Valider ma réponse
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
