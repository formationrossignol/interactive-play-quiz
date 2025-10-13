import { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

interface QuestionBankQuestionFormProps {
  question: any;
  onChange: (question: any) => void;
}

const getAcceptableAnswers = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const QuestionBankQuestionForm = ({ question, onChange }: QuestionBankQuestionFormProps) => {
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      onChange({ ...question, image: "" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange({ ...question, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const renderImageField = () => (
    <div>
      <Label>{t("questionImage")}</Label>
      {question.image && (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-border/60">
          <img src={question.image} alt="" className="h-40 w-full object-cover" />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 bg-black/60 text-white hover:bg-black/80"
            onClick={() => onChange({ ...question, image: "" })}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t("removeImage")}</span>
          </Button>
        </div>
      )}
      <label htmlFor="question-bank-image" className="mt-2 block">
        <Button variant="outline" size="sm" asChild className="w-full">
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" />
            {question.image ? t("changeImage") : t("addImage")}
          </span>
        </Button>
      </label>
      <input
        id="question-bank-image"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />
    </div>
  );

  switch (question.type) {
    case "multiple-choice":
      return (
        <div className="space-y-4">
          <div>
            <Label>{t("question")}</Label>
            <Textarea
              value={question.question}
              onChange={(e) => onChange({ ...question, question: e.target.value })}
              placeholder={t("questionPlaceholder")}
              className="mt-2"
            />
          </div>
          {renderImageField()}
          <div>
            <Label>{t("answers")}</Label>
            {question.answers.map((answer: string, index: number) => (
              <div key={index} className="mt-2 flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => {
                    const updatedAnswers = [...question.answers];
                    updatedAnswers[index] = e.target.value;
                    onChange({ ...question, answers: updatedAnswers });
                  }}
                  placeholder={`${t("answer")} ${index + 1}`}
                />
                <Button
                  variant={question.correctAnswer === index ? "default" : "outline"}
                  onClick={() => onChange({ ...question, correctAnswer: index })}
                >
                  {question.correctAnswer === index ? "✓" : "○"}
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("timeLimit")}</Label>
              <Input
                type="number"
                value={question.timeLimit}
                onChange={(e) => onChange({ ...question, timeLimit: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t("points")}</Label>
              <Input
                type="number"
                value={question.points}
                onChange={(e) => onChange({ ...question, points: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
          </div>
        </div>
      );

    case "true-false":
      return (
        <div className="space-y-4">
          <div>
            <Label>{t("question")}</Label>
            <Textarea
              value={question.question}
              onChange={(e) => onChange({ ...question, question: e.target.value })}
              placeholder={t("questionPlaceholder")}
              className="mt-2"
            />
          </div>
          {renderImageField()}
          <div>
            <Label>{t("correctAnswer")}</Label>
            <Select
              value={question.correctAnswer}
              onValueChange={(value) => onChange({ ...question, correctAnswer: value })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="true">{t("true")}</SelectItem>
                <SelectItem value="false">{t("false")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("timeLimit")}</Label>
              <Input
                type="number"
                value={question.timeLimit}
                onChange={(e) => onChange({ ...question, timeLimit: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t("points")}</Label>
              <Input
                type="number"
                value={question.points}
                onChange={(e) => onChange({ ...question, points: parseInt(e.target.value) || 0 })}
                className="mt-2"
              />
            </div>
          </div>
        </div>
      );

    case "short-answer":
      return (
        <div className="space-y-4">
          <div>
            <Label>{t("question")}</Label>
            <Textarea
              value={question.question}
              onChange={(e) => onChange({ ...question, question: e.target.value })}
              placeholder={t("questionPlaceholder")}
              className="mt-2"
            />
          </div>
          {renderImageField()}
          <div>
            <Label>{t("correctAnswer")}</Label>
            <Input
              value={question.correctAnswer}
              onChange={(e) => onChange({ ...question, correctAnswer: e.target.value })}
              placeholder={t("answer")}
              className="mt-2"
            />
          </div>
          <div>
            <Label>{t("acceptableAnswers")}</Label>
            <Input
              value={question.acceptableAnswers?.join(", ") ?? ""}
              onChange={(e) => onChange({ ...question, acceptableAnswers: getAcceptableAnswers(e.target.value) })}
              placeholder={t("acceptableAnswersHelper")}
              className="mt-2"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          <div>
            <Label>{t("question")}</Label>
            <Textarea
              value={question.question}
              onChange={(e) => onChange({ ...question, question: e.target.value })}
              placeholder={t("questionPlaceholder")}
              className="mt-2"
            />
          </div>
          {renderImageField()}
        </div>
      );
  }
};
