import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

  const handleSubmit = () => {
    const trimmedName = playerName.trim();

    if (!trimmedName) {
      return;
    }

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
    } catch (error) {
      console.warn("Unable to persist player info in sessionStorage", error);
    }

    upsertPlayerInSession(gameCode, playerRecord);

    onComplete(trimmedName, selectedAvatar);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <Card className="bg-white border-slate-100 shadow-card max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Rejoindre le quiz</h1>
            {quizTitle ? (
              <div className="text-xl font-semibold text-indigo-600 mb-1">{quizTitle}</div>
            ) : (
              <div className="text-4xl font-mono text-indigo-600 tracking-wider font-bold">{gameCode}</div>
            )}
          </div>

          <div className="space-y-6">
            {/* Avatar Selection */}
            <div>
              <Label className="text-slate-700 mb-3 block">Choisis ton avatar</Label>
              <div className="grid grid-cols-5 gap-3">
                {ENHANCED_AVATARS.map((avatar) => (
                  <button
                    key={avatar.emoji}
                    onClick={() => setSelectedAvatar(avatar.emoji)}
                    className={cn(
                      "relative group transition-all hover:scale-110 rounded-xl p-2",
                      selectedAvatar === avatar.emoji ? "scale-110" : ""
                    )}
                  >
                    <AvatarDisplay
                      emoji={avatar.emoji}
                      size="md"
                      showGlow={selectedAvatar === avatar.emoji}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <Label htmlFor="player-name" className="text-slate-700">
                Ton pseudo
              </Label>
              <Input
                id="player-name"
                placeholder="Entre ton pseudo..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 mt-2"
                maxLength={20}
              />
            </div>

            {/* Preview */}
            <div className="bg-indigo-50 rounded-lg p-4 flex items-center gap-3">
              <AvatarDisplay emoji={selectedAvatar} size="lg" />
              <div className="flex-1">
                <div className="text-slate-500 text-sm">Ton profil</div>
                <div className="text-slate-900 font-bold text-xl">
                  {playerName || "Ton pseudo"}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!playerName.trim()}
              variant="hero"
              size="lg"
              className="w-full"
            >
              C'est parti !
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};