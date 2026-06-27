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
const ROW_H = 76;
const ROW_GAP = 10;
const ROW_TOTAL = ROW_H + ROW_GAP;

const MEDAL: Record<number, { emoji: string; bg: string; border: string; textColor: string; glow: string; ringColor: string }> = {
  1: {
    emoji: '🥇',
    bg: 'linear-gradient(135deg,#FFE566,#FFCC00)',
    border: '#e5aa00',
    textColor: '#7a4000',
    glow: 'rgba(255,220,50,0.12)',
    ringColor: 'rgba(255,220,50,0.4)',
  },
  2: {
    emoji: '🥈',
    bg: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)',
    border: '#aaa',
    textColor: '#333',
    glow: 'rgba(200,200,200,0.06)',
    ringColor: 'rgba(200,200,200,0.25)',
  },
  3: {
    emoji: '🥉',
    bg: 'linear-gradient(135deg,#E8A87C,#CD7F32)',
    border: '#a06030',
    textColor: '#4a2000',
    glow: 'rgba(205,127,50,0.10)',
    ringColor: 'rgba(205,127,50,0.35)',
  },
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

    const prevOrder = [...players].sort((a, b) => (b.previousScore ?? 0) - (a.previousScore ?? 0));
    setDisplayOrder(prevOrder);
    const initScores: Record<string, number> = {};
    players.forEach(p => { initScores[p.id] = p.previousScore ?? 0; });
    setCountingScores(initScores);

    const countStart = setTimeout(() => {
      const DURATION = 900;
      const start = Date.now();
      const interval = setInterval(() => {
        const t = Math.min((Date.now() - start) / DURATION, 1);
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

  const currentRankMap: Record<string, number> = {};
  [...players].sort((a, b) => b.score - a.score).forEach((p, i) => { currentRankMap[p.id] = i + 1; });
  const prevRankMap: Record<string, number> = {};
  [...players].sort((a, b) => (b.previousScore ?? 0) - (a.previousScore ?? 0)).forEach((p, i) => { prevRankMap[p.id] = i + 1; });

  const posMap: Record<string, number> = {};
  displayOrder.forEach((p, i) => { posMap[p.id] = i * ROW_TOTAL; });

  const maxScore = Math.max(...players.map(p => p.score), 1);
  const leader = [...players].sort((a, b) => b.score - a.score)[0];

  return (
    <div
      style={{
        background: '#0f172a',
        minHeight: '100vh',
        fontFamily: 'var(--ap-font-body)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial glow behind leader */}
      {scoresReady && leader && (
        <div style={{
          position: 'absolute',
          top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,220,50,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      <div className="overflow-auto" style={{ padding: '24px 16px 40px', position: 'relative' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', paddingTop: 16, marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(135deg,rgba(255,220,50,0.2),rgba(255,176,32,0.1))',
              border: '2px solid rgba(255,220,50,0.3)',
              fontSize: 32,
              marginBottom: 12,
              boxShadow: '0 0 30px rgba(255,220,50,0.15)',
            }}>
              🏆
            </div>
            <h1 style={{
              fontFamily: 'var(--ap-font-display)',
              fontSize: 'clamp(2rem,5vw,2.6rem)',
              fontWeight: 700,
              letterSpacing: '-1px',
              margin: '0 0 4px',
              color: '#fff',
            }}>
              Classement
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 700,
              fontSize: 13,
              margin: 0,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              {isLastQuestion ? 'Résultats finaux' : 'Classement provisoire'}
            </p>
          </div>

          {/* Auto-advance bar */}
          {isHost && scoresReady && (!isLastQuestion || autoAdvance) && (
            <div style={{
              marginBottom: 20,
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.07)',
              height: 4,
            }}>
              <div style={{
                height: '100%',
                background: 'var(--ap-brand)',
                width: `${(countdown / AUTO_ADVANCE_MS) * 100}%`,
                transition: 'width 50ms linear',
                borderRadius: 4,
              }} />
            </div>
          )}

          {/* Player rows */}
          <div style={{ position: 'relative', height: players.length * ROW_TOTAL, marginBottom: 32 }}>
            {players.map((player) => {
              const rank = currentRankMap[player.id] ?? 99;
              const prevRank = prevRankMap[player.id] ?? rank;
              const rankChange = prevRank - rank;
              const medal = MEDAL[rank];
              const displayScore = countingScores[player.id] ?? (player.previousScore ?? 0);
              const progress = (displayScore / maxScore) * 100;
              const top = posMap[player.id] ?? 0;
              const isLeader = rank === 1;

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
                    background: isLeader && scoresReady
                      ? 'rgba(255,220,50,0.06)'
                      : medal
                        ? medal.glow
                        : 'rgba(255,255,255,0.035)',
                    border: `1.5px solid ${
                      isLeader && scoresReady
                        ? 'rgba(255,220,50,0.3)'
                        : medal
                          ? medal.ringColor
                          : 'rgba(255,255,255,0.07)'
                    }`,
                    borderRadius: 16,
                    boxShadow: isLeader && scoresReady
                      ? '0 0 24px rgba(255,220,50,0.12)'
                      : 'none',
                  }}
                >
                  {/* Progress fill */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0,
                    width: `${progress}%`,
                    background: isLeader
                      ? 'linear-gradient(90deg,rgba(255,220,50,0.12),transparent)'
                      : 'linear-gradient(90deg,rgba(112,72,255,0.07),transparent)',
                    transition: 'width 0.9s ease-out',
                    pointerEvents: 'none',
                  }} />

                  <div style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center',
                    gap: 12, padding: '0 16px', height: '100%',
                  }}>
                    {/* Medal / rank badge */}
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: medal ? medal.bg : 'rgba(255,255,255,0.07)',
                      border: `2px solid ${medal ? medal.border : 'rgba(255,255,255,0.12)'}`,
                      boxShadow: medal && rank === 1 ? '0 0 14px rgba(255,220,50,0.4)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: medal ? (rank === 1 ? 22 : 20) : 15,
                      color: medal ? medal.textColor : 'rgba(255,255,255,0.45)',
                    }}>
                      {medal ? medal.emoji : rank}
                    </div>

                    <AvatarDisplay emoji={player.avatar} size="sm" />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--ap-font-display)',
                        fontWeight: 700, fontSize: 15,
                        color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {player.name}
                      </div>
                      {scoresReady && rankChange !== 0 && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          marginTop: 2,
                          padding: '1px 8px',
                          borderRadius: 99,
                          background: rankChange > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                          border: `1px solid ${rankChange > 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                          fontSize: 11, fontWeight: 800,
                          color: rankChange > 0 ? '#4ade80' : '#f87171',
                          letterSpacing: 0.3,
                        }}>
                          {rankChange > 0
                            ? `▲ +${rankChange} place${rankChange > 1 ? 's' : ''}`
                            : `▼ ${Math.abs(rankChange)} place${Math.abs(rankChange) > 1 ? 's' : ''}`}
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontFamily: 'var(--ap-font-display)',
                        fontWeight: 700,
                        fontSize: isLeader ? 26 : 22,
                        color: isLeader && scoresReady ? '#FFE566' : '#fff',
                        fontVariantNumeric: 'tabular-nums',
                        transition: 'color 0.4s, font-size 0.3s',
                      }}>
                        {displayScore.toLocaleString()}
                      </div>
                      {scoresReady && (player.score - (player.previousScore ?? 0)) > 0 && (
                        <div style={{
                          color: '#4ade80', fontWeight: 800, fontSize: 11,
                          fontFamily: 'var(--ap-font-body)',
                          letterSpacing: 0.3,
                        }}>
                          +{(player.score - (player.previousScore ?? 0)).toLocaleString()} pts 🎯
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final button */}
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
    </div>
  );
};
