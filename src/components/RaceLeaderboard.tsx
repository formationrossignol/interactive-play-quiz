import { useEffect, useState } from "react";
import { AvatarDisplay } from "./BetterAvatars";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
}

interface RaceLeaderboardProps {
  players: Player[];
  onComplete?: () => void;
  isHost?: boolean;
  isLastQuestion?: boolean;
}

const MEDAL: Record<number, { bg: string; shadow: string; text: string; emoji: string }> = {
  1: { bg: 'var(--ap-flash)',      shadow: 'var(--ap-flash-deep)',   text: '#7a4000', emoji: '🥇' },
  2: { bg: '#e5e7eb',              shadow: '#9ca3af',                 text: '#4b5563', emoji: '🥈' },
  3: { bg: 'var(--ap-quiz)',       shadow: 'var(--ap-quiz-deep)',     text: '#fff',    emoji: '🥉' },
};

export const RaceLeaderboard = ({ players, onComplete, isHost = false, isLastQuestion = false }: RaceLeaderboardProps) => {
  const [animatingPlayers, setAnimatingPlayers] = useState<Player[]>([]);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    setAnimatingPlayers(players.map(p => ({ ...p, score: p.previousScore ?? 0 })));
    const t = setTimeout(() => {
      setAnimatingPlayers(players);
      setShowScores(true);
    }, 500);
    return () => clearTimeout(t);
  }, [players]);

  const sorted = [...animatingPlayers].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...sorted.map(p => p.score), 1);

  return (
    <div
      style={{ background: 'var(--ap-paper)', minHeight: '100vh', fontFamily: 'var(--ap-font-body)' }}
      className="overflow-auto p-4"
    >
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center pt-6 mb-8">
          <h1
            style={{
              fontFamily: 'var(--ap-font-display)',
              fontSize: 'clamp(2rem, 5vw, 2.8rem)',
              fontWeight: 700,
              color: 'var(--ap-ink)',
              letterSpacing: '-1px',
              margin: 0,
            }}
          >
            🏆 Classement
          </h1>
          <p style={{ color: 'var(--ap-muted)', fontWeight: 700, marginTop: 6 }}>
            Les champions du moment
          </p>
        </div>

        {/* Player rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {sorted.map((player, index) => {
            const pos = index + 1;
            const medal = MEDAL[pos];
            const progress = (player.score / maxScore) * 100;
            const delta = player.previousScore !== undefined ? player.score - player.previousScore : 0;

            return (
              <div
                key={player.id}
                className="animate-fade-in"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--ap-card)',
                  border: `2px solid ${pos === 1 ? 'var(--ap-flash)' : 'var(--ap-line)'}`,
                  borderRadius: 'var(--ap-r-lg)',
                  boxShadow: pos === 1
                    ? '0 4px 0 var(--ap-flash-deep)'
                    : 'var(--ap-shadow-soft)',
                  padding: '14px 16px',
                  animationDelay: `${index * 80}ms`,
                }}
              >
                {/* Progress fill */}
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    width: `${progress}%`,
                    background: pos === 1
                      ? 'linear-gradient(90deg,rgba(255,176,32,.14),transparent)'
                      : 'linear-gradient(90deg,rgba(112,72,255,.07),transparent)',
                    borderRadius: 'var(--ap-r-lg)',
                    transition: 'width 1s ease-out',
                  }}
                />

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Position badge */}
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: medal ? medal.bg : 'var(--ap-paper-2)',
                      boxShadow: medal ? `0 4px 0 ${medal.shadow}` : '0 3px 0 var(--ap-line)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 20,
                      color: medal ? medal.text : 'var(--ap-muted)',
                    }}
                  >
                    {medal ? medal.emoji : pos}
                  </div>

                  <AvatarDisplay emoji={player.avatar} size="md" />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 18,
                      color: 'var(--ap-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {player.name}
                    </div>
                    <div style={{ color: 'var(--ap-muted)', fontSize: 13, fontWeight: 700 }}>
                      #{pos}
                    </div>
                  </div>

                  {showScores && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 24,
                        color: 'var(--ap-ink)',
                      }}>
                        {player.score.toLocaleString()}
                      </div>
                      {delta > 0 && (
                        <div style={{
                          color: 'var(--ap-pres)', fontWeight: 800, fontSize: 13,
                          fontFamily: 'var(--ap-font-body)',
                        }}>
                          +{delta} 🎯
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isHost && showScores && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onComplete}
              className="ap-btn ap-btn--lg ap-btn--pill"
              style={
                isLastQuestion
                  ? { background: 'var(--ap-quiz)', boxShadow: '0 5px 0 var(--ap-quiz-deep)' }
                  : { background: 'var(--ap-brand)', boxShadow: '0 5px 0 var(--ap-brand-deep)' }
              }
            >
              {isLastQuestion ? '🏁 Voir les résultats finaux' : '➡️ Question suivante'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
