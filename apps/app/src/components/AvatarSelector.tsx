import { useRef, useState } from "react";
import { BrandWordmark } from "ui/BrandWordmark";
import { MaterialSymbol } from "@/components/MaterialSymbol";
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
    if (!trimmedName || hasSubmittedRef.current) return;
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

  const selected = ENHANCED_AVATARS.find((avatar) => avatar.emoji === selectedAvatar) || ENHANCED_AVATARS[0];

  return (
    <main className="live-join-shell">
      <header className="live-join-brand" aria-label="Brivia">
        <BrandWordmark size={25} color="#fff" />
        <span>Participation en direct</span>
      </header>

      <section className="live-join-card" aria-labelledby="join-heading">
        <aside className="live-join-preview">
          <div>
            <span className="live-eyebrow"><MaterialSymbol name="stadia_controller" size={18} /> Session en direct</span>
            <h1 id="join-heading">Entre dans la partie.</h1>
            <p>{quizTitle || "Choisis ton personnage et le nom qui apparaîtra à l’écran."}</p>
          </div>

          <div className="live-join-player-preview" aria-live="polite">
            <span className="live-join-avatar-halo">
              <AvatarDisplay emoji={selectedAvatar} size="xl" showGlow={false} />
            </span>
            <div>
              <small>{selected.name}</small>
              <strong>{playerName.trim() || "Ton pseudo"}</strong>
            </div>
          </div>

          <div className="live-join-trust">
            <MaterialSymbol name="verified_user" size={17} />
            <span>Aucun compte requis</span>
          </div>
        </aside>

        <form
          className="live-join-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="live-join-form__heading">
            <div>
              <span className="live-step">01</span>
              <h2>Choisis ton avatar</h2>
            </div>
            <span className="live-session-code" aria-label={`Code de session ${gameCode}`}>{gameCode}</span>
          </div>

          <div className="live-avatar-grid" role="group" aria-label="Choix de l’avatar">
            {ENHANCED_AVATARS.map((avatar) => {
              const isSelected = selectedAvatar === avatar.emoji;
              return (
                <button
                  key={avatar.emoji}
                  type="button"
                  className="live-avatar-option"
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedAvatar(avatar.emoji)}
                  title={avatar.name}
                >
                  <AvatarDisplay emoji={avatar.emoji} size="sm" showGlow={false} />
                  {isSelected && <span className="live-avatar-option__check"><MaterialSymbol name="check" size={12} /></span>}
                </button>
              );
            })}
          </div>

          <label className="live-name-field" htmlFor="participant-name">
            <span><b className="live-step">02</b> Ton pseudo</span>
            <input
              id="participant-name"
              autoComplete="nickname"
              placeholder="Ex. Camille"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              maxLength={20}
            />
            <small>{playerName.length}/20</small>
          </label>

          <button type="submit" disabled={!playerName.trim()} className="live-join-submit">
            Rejoindre la partie <MaterialSymbol name="arrow_forward" size={19} />
          </button>
        </form>
      </section>
    </main>
  );
};
