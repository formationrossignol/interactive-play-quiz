import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="min-h-screen bg-gradient-hero p-4 relative overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 animate-fade-in drop-shadow-lg">
            🏁 Classement !
          </h1>
          <p className="text-white/90 text-lg animate-fade-in" style={{ animationDelay: '200ms' }}>
            Les champions du moment
          </p>
        </div>

        <Card className="bg-white/20 backdrop-blur-xl border-white/30 shadow-2xl">
          <CardContent className="p-6">
            <div className="space-y-4">
              {sortedPlayers.map((player, index) => {
                const position = index + 1;
                const progress = (player.score / maxScore) * 100;
                
                return (
                  <div
                    key={player.id}
                    className={cn(
                      "relative bg-gradient-to-r rounded-2xl p-5 overflow-hidden animate-fade-in shadow-xl transform hover:scale-[1.02] transition-all duration-300",
                      position === 1 && "from-yellow-500/40 via-yellow-400/30 to-yellow-300/20 animate-pulse",
                      position === 2 && "from-gray-400/40 via-gray-300/30 to-gray-200/20",
                      position === 3 && "from-orange-600/40 via-orange-500/30 to-orange-400/20",
                      position > 3 && "from-white/20 via-white/15 to-white/10"
                    )}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Animated Progress Bar */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-1500 ease-out",
                          position === 1 && "bg-gradient-to-r from-yellow-400/50 via-yellow-300/30 to-transparent",
                          position === 2 && "bg-gradient-to-r from-gray-300/50 via-gray-200/30 to-transparent",
                          position === 3 && "bg-gradient-to-r from-orange-500/50 via-orange-400/30 to-transparent",
                          position > 3 && "bg-gradient-to-r from-primary/30 via-primary/20 to-transparent"
                        )}
                        style={{ width: `${progress}%` }}
                      >
                        {/* Multiple shimmer effects */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          style={{
                            animation: 'shimmer 2s infinite',
                            animationDelay: '1s'
                          }}
                        />
                      </div>
                    </div>

                    {/* Confetti for top 3 */}
                    {position <= 3 && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-2 h-2 bg-white/40 rounded-full animate-bounce"
                            style={{
                              left: `${20 + i * 15}%`,
                              top: '-10px',
                              animationDelay: `${i * 0.2}s`,
                              animationDuration: '3s'
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="relative flex items-center gap-4">
                      {/* Position Badge with Animation */}
                      <div
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0 shadow-lg transform transition-transform",
                          position === 1 && "bg-yellow-500 text-yellow-900 animate-bounce shadow-yellow-500/50",
                          position === 2 && "bg-gray-300 text-gray-900 shadow-gray-400/50",
                          position === 3 && "bg-orange-600 text-white shadow-orange-600/50",
                          position > 3 && "bg-white/30 text-white backdrop-blur-sm"
                        )}
                        style={{
                          animationDelay: position === 1 ? '0s' : 'none'
                        }}
                      >
                        {position <= 3 ? <Trophy className="w-6 h-6" /> : position}
                      </div>

                      {/* Avatar with Glow Animation */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "relative",
                          position <= 3 && "animate-pulse"
                        )}>
                          <AvatarDisplay 
                            emoji={player.avatar} 
                            size="md"
                            showGlow={position <= 3}
                          />
                          {position === 1 && (
                            <div className="absolute inset-0 rounded-full bg-yellow-400/30 animate-ping" />
                          )}
                        </div>
                        {position <= 3 && (
                          <div className={cn(
                            "absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg animate-bounce",
                            position === 1 && "bg-yellow-500 text-yellow-900",
                            position === 2 && "bg-gray-300 text-gray-900",
                            position === 3 && "bg-orange-600 text-white"
                          )}
                          style={{ animationDuration: '1.5s' }}
                          >
                            {position}
                          </div>
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "font-bold truncate text-lg",
                          position === 1 ? "text-yellow-100 drop-shadow-lg" : "text-white"
                        )}>
                          {player.name}
                        </div>
                        <div className="text-white/80 text-sm font-medium">
                          Position #{position}
                        </div>
                      </div>

                      {/* Score with Fun Animation */}
                      {showScores && (
                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-3xl font-bold animate-scale-in",
                            position === 1 ? "text-yellow-100 drop-shadow-lg" : "text-white"
                          )}>
                            {player.score}
                          </div>
                          {player.previousScore !== undefined && player.score > player.previousScore && (
                            <div className="text-green-300 text-sm font-bold animate-bounce">
                              +{player.score - player.previousScore} 🎯
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

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `
      }} />
    </div>
  );
};