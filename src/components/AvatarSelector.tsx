import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AVATARS = [
  "🦁", "🐯", "🐻", "🐼", "🐨", "🐸", "🐵", "🦊",
  "🐱", "🐶", "🐰", "🦄", "🐲", "🦖", "🐙", "🦉"
];

interface AvatarSelectorProps {
  onComplete: (name: string, avatar: string) => void;
  gameCode: string;
}

export const AvatarSelector = ({ onComplete, gameCode }: AvatarSelectorProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [playerName, setPlayerName] = useState("");

  const handleSubmit = () => {
    if (playerName.trim()) {
      onComplete(playerName, selectedAvatar);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Rejoindre le Quiz</h1>
            <div className="text-4xl font-mono text-white/80 tracking-wider font-bold">
              {gameCode}
            </div>
          </div>

          <div className="space-y-6">
            {/* Avatar Selection */}
            <div>
              <Label className="text-white mb-3 block">Choisis ton avatar</Label>
              <div className="grid grid-cols-8 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={cn(
                      "text-3xl p-2 rounded-lg transition-all hover:scale-110",
                      selectedAvatar === avatar
                        ? "bg-primary/30 ring-2 ring-primary scale-110"
                        : "bg-white/10 hover:bg-white/20"
                    )}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <Label htmlFor="player-name" className="text-white">
                Ton pseudo
              </Label>
              <Input
                id="player-name"
                placeholder="Entre ton pseudo..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 mt-2"
                maxLength={20}
              />
            </div>

            {/* Preview */}
            <div className="bg-white/10 rounded-lg p-4 flex items-center gap-3">
              <div className="text-4xl">{selectedAvatar}</div>
              <div className="text-white font-bold">
                {playerName || "Ton pseudo"}
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