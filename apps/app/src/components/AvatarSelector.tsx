import { useRef, useState } from "react";
import { ENHANCED_AVATARS, AvatarDisplay } from "./BetterAvatars";
import { ensureSessionState, upsertPlayerInSession } from "@/lib/sessionState";
import { ArrowRight, UsersRound } from "lucide-react";

interface AvatarSelectorProps {
  onComplete: (name: string, avatar: string) => void;
  gameCode: string;
  quizTitle?: string;
}

export const AvatarSelector = ({ onComplete, gameCode, quizTitle }: AvatarSelectorProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState(ENHANCED_AVATARS[0].emoji);
  const [playerName, setPlayerName] = useState("");
  const hasSubmittedRef = useRef(false);

  const handleSubmit = () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) return;
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    ensureSessionState(gameCode);

    const playerId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const playerRecord = {
      id: playerId,
      name: trimmedName,
      avatar: selectedAvatar,
      score: 0,
      correctAnswers: 0,
      joinedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(playerRecord));
    } catch {
      // sessionStorage unavailable
    }

    upsertPlayerInSession(gameCode, playerRecord);
    onComplete(trimmedName, selectedAvatar);
  };

  const selected = ENHANCED_AVATARS.find(a => a.emoji === selectedAvatar) || ENHANCED_AVATARS[0];

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card">

          {/* Header */}
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon"><UsersRound className="h-6 w-6" /></span>
            <h1>
              Rejoindre le quiz
            </h1>
            {quizTitle ? (
              <p style={{ color: 'var(--ap-brand-deep)', fontWeight: 720 }}>
                {quizTitle}
              </p>
            ) : (
              <p style={{ color: 'var(--ap-brand-deep)', fontFamily: 'var(--ap-font-mono)', fontSize: '1.1rem', fontWeight: 760, letterSpacing: '0.12em' }}>
                {gameCode}
              </p>
            )}
          </div>

          {/* Avatar grid */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 750, color: 'var(--ap-ink)', fontSize: 13, marginBottom: 10 }}>
              Choisis ton avatar
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {ENHANCED_AVATARS.map((avatar) => (
                <button
                  key={avatar.emoji}
                  onClick={() => setSelectedAvatar(avatar.emoji)}
                  style={{
                    background: selectedAvatar === avatar.emoji ? 'var(--ap-brand)' : 'var(--ap-paper)',
                    border: selectedAvatar === avatar.emoji ? '2px solid var(--ap-brand)' : 'var(--ap-border-w) solid var(--ap-line)',
                    borderRadius: 'var(--ap-r-md)',
                    padding: 4,
                    cursor: 'pointer',
                    transform: selectedAvatar === avatar.emoji ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease',
                    boxShadow: 'none',
                  }}
                  title={avatar.name}
                >
                  <AvatarDisplay emoji={avatar.emoji} size="sm" showGlow={false} />
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="participant-name" style={{ fontWeight: 750, color: 'var(--ap-ink)', fontSize: 13, display: 'block', marginBottom: 8 }}>
              Ton pseudo
            </label>
            <input
              id="participant-name"
              placeholder="Entre ton pseudo…"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              maxLength={20}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                fontFamily: 'var(--ap-font-body)',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--ap-ink)',
                background: 'var(--ap-card)',
                border: 'var(--ap-border-w) solid var(--ap-line)',
                borderRadius: 'var(--ap-r-md)',
                outline: 'none',
              }}
            />
          </div>

          {/* Preview */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            background: 'var(--ap-paper)',
            border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-md)',
            marginBottom: 20,
          }}>
            <AvatarDisplay emoji={selectedAvatar} size="lg" />
            <div>
              <div style={{ color: 'var(--ap-muted)', fontSize: 12, fontWeight: 700 }}>
                {selected.name}
              </div>
              <div style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--ap-ink)' }}>
                {playerName || '…'}
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!playerName.trim()}
            className="ap-btn ap-btn--lg ap-btn--pill"
            style={{
              width: '100%',
              background: playerName.trim() ? 'var(--ap-brand)' : 'var(--ap-muted)',
              boxShadow: 'none',
              cursor: playerName.trim() ? 'pointer' : 'not-allowed',
              opacity: playerName.trim() ? 1 : 0.6,
            }}
          >
            Rejoindre <ArrowRight className="h-4 w-4" />
          </button>
      </div>
    </div>
  );
};
