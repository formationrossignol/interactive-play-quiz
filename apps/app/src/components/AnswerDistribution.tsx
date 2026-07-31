import { useEffect, useState, type CSSProperties } from "react";
import { HOST_ANSWER_STYLES } from "@/lib/answerVisuals";

const ANSWER_COLORS = [
  { bg: '#f06455', deep: '#b93931' },
  { bg: '#3b82d0', deep: '#235c99' },
  { bg: '#e7a51d', deep: '#a66b00' },
  { bg: '#22a871', deep: '#116d49' },
];

interface AnswerDistributionProps {
  answers: string[];
  distribution: number[];
  correctAnswer: number | string | boolean | undefined;
}

export const AnswerDistribution = ({ answers, distribution, correctAnswer }: AnswerDistributionProps) => {
  const correctIndex = (correctAnswer === 'true' || correctAnswer === true) ? 0
    : (correctAnswer === 'false' || correctAnswer === false) ? 1
      : typeof correctAnswer === 'number' ? correctAnswer
        : -1;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="live-distribution" aria-labelledby="distribution-title">
      <div className="live-distribution-label">
        <span id="distribution-title">Répartition des réponses</span>
        <span>Bonne réponse signalée en vert</span>
      </div>

      <div className="live-distribution-list">
        {answers.map((answer, index) => {
          const color = ANSWER_COLORS[index % ANSWER_COLORS.length];
          const percentage = distribution[index] ?? 0;
          const isCorrect = index === correctIndex;

          return (
            <article
              key={`${answer}-${index}`}
              className="live-distribution-row"
              data-correct={isCorrect}
              style={{ '--answer-color': color.bg, '--answer-deep': color.deep } as CSSProperties}
            >
              <div
                className="live-distribution-fill"
                style={{ transform: `scaleX(${animated ? percentage / 100 : 0})` }}
                aria-hidden="true"
              />
              <span className="live-distribution-shape" aria-hidden="true">
                {isCorrect ? '✓' : HOST_ANSWER_STYLES[index % 4].shape}
              </span>
              <strong>{answer}</strong>
              <span className="live-distribution-value">{percentage}%</span>
            </article>
          );
        })}
      </div>
    </section>
  );
};
