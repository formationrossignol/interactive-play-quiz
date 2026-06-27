import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AnswerDistribution } from "./AnswerDistribution";

interface QuizSessionAnswerDistributionProps {
  currentQuestion: any;
  answerDistribution: number[];
  onNext: () => void;
  onSkipToNext?: () => void;
  isHost: boolean;
  isLastQuestion?: boolean;
  autoAdvance?: boolean;
}

export const QuizSessionAnswerDistribution = ({
  currentQuestion,
  answerDistribution,
  onNext,
  onSkipToNext,
  isHost,
  isLastQuestion = false,
  autoAdvance = false,
}: QuizSessionAnswerDistributionProps) => {
  useEffect(() => {
    if (!isHost || !autoAdvance) return;
    const t = setTimeout(() => onNext(), 3500);
    return () => clearTimeout(t);
  }, [isHost, autoAdvance, onNext]);

  const totalVotes = answerDistribution.reduce((a, b) => a + b, 0);
  const percentages = answerDistribution.map(count =>
    totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      padding: '24px 16px 32px',
      color: '#fff',
      fontFamily: 'var(--ap-font-body)',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Question header */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1.5px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '24px 28px',
          marginBottom: 28,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(112,72,255,0.25)',
              border: '1.5px solid rgba(112,72,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              📊
            </div>
            <span style={{
              fontFamily: 'var(--ap-font-display)',
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              Résultats
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--ap-font-display)',
            fontSize: 'clamp(1.4rem, 4vw, 2rem)',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.2,
            letterSpacing: '-0.5px',
            margin: 0,
          }}>
            {currentQuestion.question}
          </h1>
        </div>

        {/* Distribution bars */}
        {currentQuestion.answers && (
          <AnswerDistribution
            answers={currentQuestion.answers}
            distribution={percentages}
            correctAnswer={currentQuestion.correctAnswer}
          />
        )}

        {/* Host controls */}
        {isHost && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginTop: 36,
            flexWrap: 'wrap',
          }}>
            {onSkipToNext && (
              <button
                onClick={onSkipToNext}
                className="ap-btn ap-btn--ghost ap-btn--lg ap-btn--pill"
                style={{ color: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', boxShadow: 'none' }}
              >
                ➡️ Question suivante
              </button>
            )}
            <button
              onClick={onNext}
              className="ap-btn ap-btn--lg ap-btn--pill"
              style={{ background: 'var(--ap-brand)', boxShadow: '0 5px 0 var(--ap-brand-deep)' }}
            >
              {isLastQuestion ? '🏁 Voir les résultats finaux' : '🏆 Voir le classement'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
