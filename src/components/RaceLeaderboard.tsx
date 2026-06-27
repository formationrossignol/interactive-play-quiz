import { useCallback, useEffect, useRef, useState } from "react";
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
  autoAdvance?: boolean;
}

const AUTO_ADVANCE_MS = 6000;
const ROW_H = 80;
const ROW_GAP = 10;
const ROW_TOTAL = ROW_H + ROW_GAP;

const MEDAL: Record<number, { emoji: string; bg: string; border: string; textColor: string; glow: string }> = {
  1: { emoji: '🥇', bg: 'linear-gradient(135deg,#FFE566,#FFCC00)', border: '#e5aa00', textColor: '#7a4000', glow: 'rgba(255,220,50,0.15)' },
  2: { emoji: '🥈', bg: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)', border: '#aaa', textColor: '#333', glow: 'rgba(200,200,200,0.08)' },
  3: { emoji: '🥉', bg: 'linear-gradient(135deg,#E8A87C,#CD7F32)', border: '#a06030', textColor: '#4a2000', glow: 'rgba(205,127,50,0.12)' },
};

export const RaceLeaderboard = ({
  players,
  onComplete,
  isHost = false,
  isLastQuestion = false,
  autoAdvance = false,
}: RaceLeaderboardProps) => {
  const [displayOrder, setDisplayOrder] = useState<Player[]>([]);
  const [countingScores, setCountingScores] = useState<Record<string, number>>({});
  const [scoresReady, setScoresReady] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_MS);
  const onCompleteRef = useRef(onComplete);
  const firedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; });

  const stableOnComplete = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current?.();
    }
  }, []);

  useEffect(() => {
    firedRef.current = false;
    setScoresReady(false);

    // Phase 1: render in previous order with previous scores
    const prevOrder = [...players].sort((a, b) => (b.previousScore ?? 0) - (a.previousScore ?? 0));
    setDisplayOrder(prevOrder);
    const initScores: Record<string, number> = {};
    players.forEach(p => { initScores[p.id] = p.previousScore ?? 0; });
    setCountingScores(initScores);

    // Phase 2: count scores up rapidly
    const countStart = setTimeout(() => {
      const DURATION = 900;
      const start = Date.now();
      const interval = setInterval(() => {
        const t = Math.min((Date.now() - start) / DURATION, 1);
        // ease-out quad
        const eased = 1 - Math.pow(1 - t, 2);
        setCountingScores(() => {
          const next: Record<string, number> = {};
          players.forEach(p => {
            next[p.id] = Math.round((p.previousScore ?? 0) + (p.score - (p.previousScore ?? 0)) * eased);
          });
          return next;
        });
        if (t >= 1) {
          clearInterval(interval);
          // Phase 3: animate rows to new order
          setTimeout(() => {
            setDisplayOrder([...players].sort((a, b) => b.score - a.score));
            setScoresReady(true);
          }, 350);
        }
      }, 16);
      return () => clearInterval(interval);
    }, 200);

    return () => clearTimeout(countStart);
  }, [players]);

  // Auto-advance countdown
  useEffect(() => {
    if (!scoresReady || !isHost) return;
    if (isLastQuestion && !autoAdvance) return;
    setCountdown(AUTO_ADVANCE_MS);
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = AUTO_ADVANCE_MS - (Date.now() - start);
      if (remaining <= 0) {
        clearInterval(interval);
        stableOnComplete();
      } else {
        setCountdown(remaining);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [scoresReady, isLastQuestion, isHost, autoAdvance, stableOnComplete]);

  // Rank maps
  const currentRankMap: Record<string, number> = {};
  [...players].sort((a, b) => b.score - a.score).forEach((p, i) => { currentRankMap[p.id] = i + 1; });
  const prevRankMap: Record<string, number> = {};
  [...players].sort((a, b) => (b.previousScore ?? 0) - (a.previousScore ?? 0)).forEach((p, i) => { prevRankMap[p.id] = i + 1; });

  // Position map drives the animated top values
  const posMap: Record<string, number> = {};
  displayOrder.forEach((p, i) => { posMap[p.id] = i * ROW_TOTAL; });

  const maxScore = Math.max(...players.map(p => p.score), 1);

  return (
    <div
      style={{ background: '#0f172a', minHeight: '100vh', fontFamily: 'var(--ap-font-body)', color: '#fff' }}
      className="overflow-auto p-4"
    >
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center pt-6 mb-6">
          <h1 style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(2rem,5vw,2.8rem)', fontWeight: 700, letterSpacing: '-1px', margin: 0 }}>
            🏆 Classement
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginTop: 6, fontSize: 14 }}>
            {isLastQuestion ? 'Résultats finaux' : 'Classement provisoire'}
          </p>
        </div>

        {/* Auto-advance bar */}
        {isHost && scoresReady && (!isLastQuestion || autoAdvance) && (
          <div style={{ marginBottom: 16, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.08)', height: 4 }}>
            <div style={{
              height: '100%',
              background: 'var(--ap-brand)',
              width: `${(countdown / AUTO_ADVANCE_MS) * 100}%`,
              transition: 'width 50ms linear',
            }} />
          </div>
        )}

        {/* Animated player rows */}
        <div style={{ position: 'relative', height: players.length * ROW_TOTAL, marginBottom: 32 }}>
          {players.map((player) => {
            const rank = currentRankMap[player.id] ?? 99;
            const prevRank = prevRankMap[player.id] ?? rank;
            const rankChange = prevRank - rank; // positive = moved up
            const medal = MEDAL[rank];
            const displayScore = countingScores[player.id] ?? (player.previousScore ?? 0);
            const progress = (displayScore / maxScore) * 100;
            const top = posMap[player.id] ?? 0;

            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  top,
                  left: 0, right: 0,
                  height: ROW_H,
                  transition: 'top 0.65s cubic-bezier(0.34,1.56,0.64,1)',
                  overflow: 'hidden',
                  background: medal ? medal.glow : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${medal
                    ? (rank === 1 ? 'rgba(255,220,50,0.35)' : rank === 2 ? 'rgba(200,200,200,0.25)' : 'rgba(205,127,50,0.35)')
                    : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                }}
              >
                {/* Progress fill */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${progress}%`,
                  background: rank === 1
                    ? 'linear-gradient(90deg,rgba(255,220,50,.1),transparent)'
                    : 'linear-gradient(90deg,rgba(112,72,255,.07),transparent)',
                  transition: 'width 0.9s ease-out',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: '100%' }}>
                  {/* Medal / position badge */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: medal ? medal.bg : 'rgba(255,255,255,0.08)',
                    border: `2px solid ${medal ? medal.border : 'rgba(255,255,255,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: medal ? 20 : 15,
                    color: medal ? medal.textColor : 'rgba(255,255,255,0.5)',
                  }}>
                    {medal ? medal.emoji : rank}
                  </div>

                  <AvatarDisplay emoji={player.avatar} size="sm" />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </div>
                    {scoresReady && rankChange !== 0 && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: rankChange > 0 ? '#4ade80' : '#f87171', letterSpacing: 0.5 }}>
                        {rankChange > 0 ? `▲ +${rankChange} place${rankChange > 1 ? 's' : ''}` : `▼ ${Math.abs(rankChange)} place${Math.abs(rankChange) > 1 ? 's' : ''}`}
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                      {displayScore.toLocaleString()}
                    </div>
                    {scoresReady && (player.score - (player.previousScore ?? 0)) > 0 && (
                      <div style={{ color: '#4ade80', fontWeight: 800, fontSize: 11, fontFamily: 'var(--ap-font-body)' }}>
                        +{(player.score - (player.previousScore ?? 0)).toLocaleString()} 🎯
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Manual button when last question and not auto-advancing */}
        {isHost && scoresReady && isLastQuestion && !autoAdvance && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 32 }}>
            <button
              onClick={stableOnComplete}
              className="ap-btn ap-btn--lg ap-btn--pill"
              style={{ background: 'var(--ap-brand)', boxShadow: '0 5px 0 var(--ap-brand-deep)' }}
            >
              🏁 Voir les résultats finaux
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
