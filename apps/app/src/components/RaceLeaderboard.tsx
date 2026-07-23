import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarDisplay } from "./BetterAvatars";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  streak?: number;
}

interface RaceLeaderboardProps {
  players: Player[];
  onComplete?: () => void;
  isHost?: boolean;
  isLastQuestion?: boolean;
  autoAdvance?: boolean;
  questionIndex?: number;
  totalQuestions?: number;
  okPct?: number;
}

const AUTO_ADVANCE_MS = 6000;
const ROW_H = 76;
const ROW_GAP = 10;
const ROW_TOTAL = ROW_H + ROW_GAP;

export const RaceLeaderboard = ({
  players,
  onComplete,
  isHost = false,
  isLastQuestion = false,
  autoAdvance = false,
  questionIndex,
  totalQuestions,
  okPct,
}: RaceLeaderboardProps) => {
  // Design tokens — translucent dark surfaces so the screen sits on the quiz
  // theme (rendered by ThemedBackground in QuizSession) like the other phases.
  const PAPER = 'rgba(10, 14, 30, 0.45)';       // gap bar
  const PAPER_2 = 'rgba(255,255,255,0.10)';
  const CARD = 'rgba(16, 20, 40, 0.62)';
  const LINE = 'rgba(255,255,255,0.14)';
  const INK = '#ffffff';
  const MUTED = '#cfc8e8';
  const BRAND = '#9a7dff';
  const BRAND_DEEP = '#4f2fd0';
  const BRAND_SOFT = 'rgba(112,72,255,0.25)';
  const BRAND_TEXT = '#d7c9ff';
  const GOLD = '#ffb020';
  const FLASH_DEEP = '#a86e00';
  const FLASH_TEXT = '#ffd27a';
  const FLASH_SOFT = 'rgba(255,176,32,0.14)';
  const PRES_DEEP = '#4ade9d';
  const PRES_SOFT = 'rgba(21,192,138,0.16)';
  const QUIZ_DEEP = '#ff9a8f';
  const QUIZ_SOFT = 'rgba(255,90,77,0.16)';
  const SILVER = '#cfd4e2';
  const BRONZE = '#e08a5a';
  const MEDAL_TEXT = '#241b3a';
  const R_MD = 16;
  const R_PILL = 999;
  const MEDAL_BG: Record<number, string> = { 1: GOLD, 2: SILVER, 3: BRONZE };
  const MEDAL_SHADOW: Record<number, string> = {
    1: `0 3px 0 ${FLASH_DEEP}`,
    2: '0 3px 0 #9aa2b8',
    3: '0 3px 0 #b05f30',
  };

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

  const bestClimber: { name: string; climb: number } | null = scoresReady
    ? (() => {
        let best: { name: string; climb: number } | null = null;
        displayOrder.forEach((p) => {
          const climb = (prevRankMap[p.id] ?? 99) - (currentRankMap[p.id] ?? 99);
          if (climb > 0 && (!best || climb > best.climb)) best = { name: p.name, climb };
        });
        return best;
      })()
    : null;

  const leaderScore = Math.max(...players.map(p => p.score), 1);

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--ap-font-body)',
      color: INK,
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
    }}>
      <div style={{ flex: 1, maxWidth: 880, margin: '0 auto', width: '100%', padding: '34px 24px 130px' }}>

        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 8 }}>
          {questionIndex != null && totalQuestions != null && (
            <div style={{ marginBottom: 14 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                color: BRAND_TEXT, background: BRAND_SOFT,
                border: `2px solid rgba(112,72,255,0.32)`,
                padding: '6px 15px', borderRadius: R_PILL,
              }}>
                📊 Classement · question {questionIndex}/{totalQuestions}
              </span>
            </div>
          )}
          <h1 style={{
            fontFamily: 'var(--ap-font-display)',
            fontWeight: 600,
            fontSize: 'clamp(28px, 4vw, 40px)',
            margin: 0,
          }}>
            {isLastQuestion ? '🏆 Résultats finaux' : 'Qui mène la course ?'}
          </h1>
          {okPct != null && (
            <p style={{ marginTop: 8, fontWeight: 700, fontSize: 14.5, color: MUTED }}>
              Sur cette question : <b style={{ color: PRES_DEEP }}>{okPct} %</b> de bonnes réponses
            </p>
          )}
        </header>

        {/* Callout — best climber */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 22px', minHeight: 44 }}>
          {bestClimber && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 17,
              color: FLASH_TEXT, background: FLASH_SOFT,
              border: `2px solid rgba(255,176,32,0.5)`,
              padding: '9px 20px', borderRadius: R_PILL,
              boxShadow: `0 4px 0 rgba(255,176,32,0.45)`,
              animation: 'callout-in 0.5s cubic-bezier(.2,.7,.3,1.3) forwards',
            }}>
              🚀 {bestClimber.name} gagne {bestClimber.climb} place{bestClimber.climb > 1 ? 's' : ''} !
            </span>
          )}
        </div>

        {/* Board */}
        <section
          aria-label="Classement des joueurs"
          style={{ position: 'relative', height: players.length * ROW_TOTAL }}
        >
          {players.map((player) => {
            const rank = currentRankMap[player.id] ?? 99;
            const prevRank = prevRankMap[player.id] ?? rank;
            const rankChange = prevRank - rank;
            const displayScore = countingScores[player.id] ?? (player.previousScore ?? 0);
            const scoreGain = player.score - (player.previousScore ?? 0);
            const top = posMap[player.id] ?? 0;
            const isFirst = rank === 1;
            const gapWidth = Math.round((displayScore / leaderScore) * 100);

            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  top,
                  left: 0, right: 0,
                  height: ROW_H,
                  transition: 'top 0.65s cubic-bezier(.2,.7,.3,1.3)',
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: CARD,
                  border: `2px solid ${isFirst && scoresReady ? 'rgba(255,176,32,0.6)' : LINE}`,
                  borderRadius: R_MD,
                  padding: '0 18px 0 14px',
                  boxShadow: isFirst && scoresReady
                    ? `0 4px 0 rgba(255,176,32,0.55), 0 14px 30px rgba(255,176,32,.14)`
                    : `0 4px 0 ${LINE}`,
                  overflow: 'hidden',
                }}
              >
                {/* Gap bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 0,
                  background: PAPER,
                  borderRight: `2px solid ${LINE}`,
                  width: `${100 - gapWidth}%`,
                  transition: 'width 0.8s ease-out',
                  pointerEvents: 'none',
                }} />

                {/* Rank badge */}
                <div style={{
                  position: 'relative', zIndex: 1,
                  flex: 'none', width: 40, height: 40, borderRadius: 12,
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 19,
                  background: MEDAL_BG[rank] ?? PAPER_2,
                  color: MEDAL_BG[rank] ? MEDAL_TEXT : MUTED,
                  boxShadow: MEDAL_SHADOW[rank] ?? 'none',
                  transition: 'background 0.4s, color 0.4s',
                }}>
                  {rank}
                </div>

                {/* Avatar */}
                <div style={{
                  position: 'relative', zIndex: 1,
                  flex: 'none', width: 46, height: 46, borderRadius: '50%',
                  background: PAPER_2, border: `2px solid ${LINE}`,
                  display: 'grid', placeItems: 'center', fontSize: 23,
                  overflow: 'hidden',
                }}>
                  <AvatarDisplay emoji={player.avatar} size="sm" />
                </div>

                {/* Name + streak */}
                <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{
                    fontWeight: 800, fontSize: 17,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {player.name}
                  </span>
                  {(player.streak ?? 0) >= 2 && (
                    <span style={{
                      fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 12.5,
                      color: QUIZ_DEEP, background: QUIZ_SOFT,
                      border: `2px solid rgba(255,90,77,0.4)`,
                      borderRadius: R_PILL, padding: '2px 9px',
                      flexShrink: 0,
                    }}>
                      🔥 {player.streak}
                    </span>
                  )}
                </div>

                {/* Movement badge */}
                {scoresReady && rankChange !== 0 && (
                  <div style={{
                    position: 'relative', zIndex: 1,
                    flex: 'none', minWidth: 46, textAlign: 'center',
                    fontSize: 12.5, fontWeight: 800, borderRadius: R_PILL, padding: '4px 10px',
                    color: rankChange > 0 ? PRES_DEEP : QUIZ_DEEP,
                    background: rankChange > 0 ? PRES_SOFT : QUIZ_SOFT,
                    animation: 'mv-pop 0.4s cubic-bezier(.2,.7,.3,1.3) forwards',
                  }}>
                    {rankChange > 0 ? `▲ ${rankChange}` : `▼ ${-rankChange}`}
                  </div>
                )}

                {/* Score */}
                <div style={{ position: 'relative', zIndex: 1, flex: 'none', textAlign: 'right', minWidth: 92 }}>
                  <div style={{
                    fontFamily: 'var(--ap-font-mono)', fontWeight: 700, fontSize: 18,
                    fontVariantNumeric: 'tabular-nums',
                    color: isFirst && scoresReady ? GOLD : INK,
                    transition: 'color 0.4s',
                  }}>
                    {displayScore.toLocaleString('fr-FR')}
                  </div>
                  {scoresReady && scoreGain > 0 && (
                    <div style={{
                      fontSize: 11.5, color: PRES_DEEP, fontWeight: 700,
                      animation: 'plus-in 0.35s ease forwards',
                    }}>
                      +{scoreGain.toLocaleString('fr-FR')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: MUTED, marginTop: 14 }}>
          {players.length} joueur{players.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Host bar */}
      {isHost && scoresReady && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'rgba(12, 15, 32, 0.85)', borderTop: `2px solid ${LINE}`,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 -14px 34px rgba(0,0,0,.25)',
        }}>
          <div style={{
            maxWidth: 880, margin: '0 auto', padding: '14px 24px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {questionIndex != null && totalQuestions != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 13.5, color: MUTED }}>
                <span style={{ fontFamily: 'var(--ap-font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {questionIndex}/{totalQuestions}
                </span>
                <span style={{
                  width: 130, height: 8, background: PAPER_2,
                  border: `2px solid ${LINE}`, borderRadius: R_PILL, overflow: 'hidden',
                  display: 'flex',
                }}>
                  <i style={{
                    display: 'block', height: '100%', background: BRAND, borderRadius: R_PILL,
                    width: `${(questionIndex / totalQuestions) * 100}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </span>
                questions
              </span>
            )}

            <div style={{ flex: 1 }} />

            {!isLastQuestion && (
              <div style={{ width: 100, height: 4, background: PAPER_2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: BRAND, borderRadius: 4,
                  width: `${(countdown / AUTO_ADVANCE_MS) * 100}%`,
                  transition: 'width 50ms linear',
                }} />
              </div>
            )}

            <button
              onClick={stableOnComplete}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
                padding: '13px 26px', borderRadius: R_PILL, border: 'none', cursor: 'pointer',
                color: isLastQuestion ? MEDAL_TEXT : '#fff',
                background: isLastQuestion ? GOLD : 'var(--ap-brand)',
                boxShadow: isLastQuestion ? `0 5px 0 ${FLASH_DEEP}` : `0 5px 0 ${BRAND_DEEP}`,
              }}
            >
              {isLastQuestion ? '🏆 Voir le podium final' : 'Question suivante →'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes callout-in { from { opacity: 0; transform: translateY(10px) scale(.9); } to { opacity: 1; transform: none; } }
        @keyframes mv-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes plus-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
};
