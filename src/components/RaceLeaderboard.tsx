import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export const RaceLeaderboard = ({ players, onComplete }: RaceLeaderboardProps) => {
  const [animatingPlayers, setAnimatingPlayers] = useState<Player[]>([]);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    // Start with previous positions
    setAnimatingPlayers(players.map(p => ({ ...p, score: p.previousScore || 0 })));
    
    // Animate to new positions after a delay
    const timer1 = setTimeout(() => {
      setAnimatingPlayers(players);
      setShowScores(true);
    }, 500);

    // Complete animation
    const timer2 = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [players, onComplete]);

  const sortedPlayers = [...animatingPlayers].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...sortedPlayers.map(p => p.score), 1);

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-in">
            🏁 Course en tête !
          </h1>
        </div>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-6">
            <div className="space-y-3">
              {sortedPlayers.map((player, index) => {
                const position = index + 1;
                const progress = (player.score / maxScore) * 100;
                
                return (
                  <div
                    key={player.id}
                    className="relative bg-white/10 rounded-xl p-4 overflow-hidden animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Progress Background */}
                    <div
                      className={cn(
                        "absolute inset-0 transition-all duration-1000 ease-out",
                        position === 1 && "bg-gradient-to-r from-yellow-500/20 to-transparent",
                        position === 2 && "bg-gradient-to-r from-gray-400/20 to-transparent",
                        position === 3 && "bg-gradient-to-r from-orange-600/20 to-transparent",
                        position > 3 && "bg-gradient-to-r from-primary/10 to-transparent"
                      )}
                      style={{ width: `${progress}%` }}
                    />

                    <div className="relative flex items-center gap-4">
                      {/* Position Badge */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                          position === 1 && "bg-yellow-500 text-yellow-900",
                          position === 2 && "bg-gray-400 text-gray-900",
                          position === 3 && "bg-orange-600 text-orange-100",
                          position > 3 && "bg-white/20 text-white"
                        )}
                      >
                        {position <= 3 ? <Trophy className="w-5 h-5" /> : position}
                      </div>

                      {/* Avatar */}
                      <div className="text-4xl shrink-0">{player.avatar}</div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold truncate">{player.name}</div>
                        <div className="text-white/60 text-sm">#{position}</div>
                      </div>

                      {/* Score with Animation */}
                      {showScores && (
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-white animate-scale-in">
                            {player.score}
                          </div>
                          {player.previousScore !== undefined && player.score > player.previousScore && (
                            <div className="text-success text-sm animate-fade-in">
                              +{player.score - player.previousScore}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};