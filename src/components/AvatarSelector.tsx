import { useRef, useState } from "react";
import { ENHANCED_AVATARS, AvatarDisplay } from "./BetterAvatars";
import { ensureSessionState, upsertPlayerInSession } from "@/lib/sessionState";

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
    <div style={{ minHeight: '100vh', background: 'var(--ap-paper)', fontFamily: 'var(--ap-font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        <div className="ap-card" style={{ boxShadow: 'var(--ap-shadow-card)' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--ap-ink)', margin: 0 }}>
              Rejoindre le quiz
            </h1>
            {quizTitle ? (
              <div style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--ap-brand)', marginTop: 6 }}>
                {quizTitle}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--ap-font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--ap-brand)', letterSpacing: '0.12em', marginTop: 6 }}>
                {gameCode}
              </div>
            )}
          </div>

          {/* Avatar grid */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: 'var(--ap-muted)', fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Choisis ton avatar
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {ENHANCED_AVATARS.map((avatar) => (
                <button
                  key={avatar.emoji}
                  onClick={() => setSelectedAvatar(avatar.emoji)}
                  style={{
                    background: selectedAvatar === avatar.emoji ? 'var(--ap-brand)' : 'var(--ap-paper)',
                    border: selectedAvatar === avatar.emoji ? '2px solid var(--ap-brand)' : '2px solid var(--ap-line)',
                    borderRadius: 'var(--ap-r-md)',
                    padding: 4,
                    cursor: 'pointer',
                    transform: selectedAvatar === avatar.emoji ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    boxShadow: selectedAvatar === avatar.emoji ? '0 4px 0 var(--ap-brand-deep)' : 'none',
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
            <label style={{ fontWeight: 700, color: 'var(--ap-muted)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              Ton pseudo
            </label>
            <input
              placeholder="Entre ton pseudo…"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              maxLength={20}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                fontFamily: 'var(--ap-font-body)',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--ap-ink)',
                background: 'var(--ap-paper)',
                border: '2px solid var(--ap-line)',
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
            border: '2px solid var(--ap-line)',
            borderRadius: 'var(--ap-r-md)',
            marginBottom: 20,
          }}>
            <AvatarDisplay emoji={selectedAvatar} size="lg" />
            <div>
              <div style={{ color: 'var(--ap-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
              boxShadow: playerName.trim() ? '0 5px 0 var(--ap-brand-deep)' : 'none',
              cursor: playerName.trim() ? 'pointer' : 'not-allowed',
              opacity: playerName.trim() ? 1 : 0.6,
            }}
          >
            🚀 C'est parti !
          </button>
        </div>
      </div>
    </div>
  );
};
