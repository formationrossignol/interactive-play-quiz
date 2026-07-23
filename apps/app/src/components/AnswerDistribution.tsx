import { useEffect, useState } from "react";
import { HOST_ANSWER_STYLES } from "@/lib/answerVisuals";

// Mêmes couleurs et formes que les tuiles de l'écran question du présentateur
const ANSWER_COLORS = [
  { bg: '#E74C3C', deep: '#B03A2E' },
  { bg: '#2980B9', deep: '#1F618D' },
  { bg: '#F39C12', deep: '#B9770E' },
  { bg: '#27AE60', deep: '#1E8449' },
];

interface AnswerDistributionProps {
  answers: string[];
  distribution: number[];
  correctAnswer: number | string | boolean;
}

export const AnswerDistribution = ({ answers, distribution, correctAnswer }: AnswerDistributionProps) => {
  const correctIndex = (correctAnswer === 'true' || correctAnswer === true) ? 0 : (correctAnswer === 'false' || correctAnswer === false) ? 1 : correctAnswer as number;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <p style={{
        fontFamily: 'var(--ap-font-display)',
        fontSize: 14,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        marginBottom: 20,
        margin: '0 0 20px',
      }}>
        Répartition des réponses
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {answers.map((answer, i) => {
          const color = ANSWER_COLORS[i % ANSWER_COLORS.length];
          const pct = distribution[i] ?? 0;
          const isCorrect = i === correctIndex;

          return (
            <div key={i} style={{ position: 'relative', height: 64, borderRadius: 14, overflow: 'hidden' }}>
              {/* Track */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${isCorrect ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 14,
                boxShadow: isCorrect ? '0 0 20px rgba(34,197,94,0.15)' : 'none',
              }} />

              {/* Fill bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: animated ? `${pct}%` : '0%',
                background: isCorrect
                  ? 'linear-gradient(90deg,rgba(34,197,94,0.35),rgba(34,197,94,0.12))'
                  : `linear-gradient(90deg,${color.bg}22,${color.bg}08)`,
                transition: 'width 1s cubic-bezier(0.2,0.7,0.3,1)',
                borderRadius: '12px 0 0 12px',
              }} />

              {/* Row content */}
              <div style={{
                position: 'relative',
                display: 'flex', alignItems: 'center',
                height: '100%', padding: '0 14px', gap: 12,
              }}>
                {/* Letter badge */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isCorrect ? '#22c55e' : color.bg,
                  boxShadow: `0 3px 0 ${isCorrect ? '#16a34a' : color.deep}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--ap-font-display)',
                  fontWeight: 700, fontSize: 17, color: '#fff',
                }}>
                  {isCorrect ? '✓' : HOST_ANSWER_STYLES[i % 4].shape}
                </div>

                {/* Answer text */}
                <div style={{
                  flex: 1, minWidth: 0,
                  fontFamily: 'var(--ap-font-body)',
                  fontWeight: 700, fontSize: 15,
                  color: isCorrect ? '#fff' : 'rgba(255,255,255,0.75)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {answer}
                </div>

                {/* Percentage */}
                <div style={{
                  fontFamily: 'var(--ap-font-display)',
                  fontWeight: 700,
                  fontSize: pct >= 10 ? 26 : 22,
                  color: isCorrect ? '#4ade80' : 'rgba(255,255,255,0.6)',
                  flexShrink: 0, minWidth: 56, textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'color 0.3s',
                }}>
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
