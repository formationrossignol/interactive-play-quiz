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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 p-4 text-slate-100">
      {/* Animated Background Particles with Movement */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${4 + Math.random() * 12}px`,
              height: `${4 + Math.random() * 12}px`,
              backgroundColor: ['rgba(148, 163, 184, 0.35)', 'rgba(251, 191, 36, 0.45)', 'rgba(56, 189, 248, 0.35)'][Math.floor(Math.random() * 3)],
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>
      
      {/* Flying stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute text-2xl text-yellow-300 animate-fly-across"
            style={{
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 3}s`
            }}
          >
            ⭐
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="mb-4 text-4xl font-bold text-white drop-shadow-2xl animate-fade-in md:text-6xl">
            🏁 Classement !
          </h1>
          <p className="text-lg text-slate-200 animate-fade-in" style={{ animationDelay: '200ms' }}>
            Les champions du moment
          </p>
        </div>

        <Card className="border border-slate-700/70 bg-slate-900/85 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-6">
            <div className="space-y-4">
              {sortedPlayers.map((player, index) => {
                const position = index + 1;
                const progress = (player.score / maxScore) * 100;

                return (
                  <div
                    key={player.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-r p-5 text-slate-100 shadow-xl transition-all duration-300 hover:scale-[1.02] animate-fade-in",
                      position === 1 && "from-yellow-500/40 via-yellow-400/30 to-yellow-300/20 animate-pulse",
                      position === 2 && "from-slate-500/40 via-slate-400/30 to-slate-300/20",
                      position === 3 && "from-orange-600/40 via-orange-500/30 to-orange-400/20",
                      position > 3 && "from-slate-900/90 via-slate-900/75 to-slate-900/60"
                    )}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Animated Progress Bar */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-1500 ease-out",
                          position === 1 && "bg-gradient-to-r from-yellow-400/60 via-yellow-300/40 to-transparent",
                          position === 2 && "bg-gradient-to-r from-slate-300/60 via-slate-200/40 to-transparent",
                          position === 3 && "bg-gradient-to-r from-orange-500/60 via-orange-400/40 to-transparent",
                          position > 3 && "bg-gradient-to-r from-primary/50 via-primary/30 to-transparent"
                        )}
                        style={{ width: `${progress}%` }}
                      >
                        {/* Multiple shimmer effects */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
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
                          position === 2 && "bg-slate-300 text-slate-900 shadow-slate-400/50",
                          position === 3 && "bg-orange-600 text-white shadow-orange-600/50",
                          position > 3 && "bg-slate-800/80 text-slate-100 backdrop-blur-sm"
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
                        <div className="text-slate-200 text-sm font-medium">
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
                            <div className="text-emerald-300 text-sm font-bold animate-bounce">
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
          @keyframes float {
            0%, 100% { 
              transform: translate(0, 0) rotate(0deg);
              opacity: 0.3;
            }
            25% { 
              transform: translate(20px, -30px) rotate(90deg);
              opacity: 0.6;
            }
            50% { 
              transform: translate(-20px, -60px) rotate(180deg);
              opacity: 0.8;
            }
            75% { 
              transform: translate(30px, -30px) rotate(270deg);
              opacity: 0.6;
            }
          }
          @keyframes fly-across {
            0% { 
              transform: translateX(-100vw) translateY(0) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% { 
              transform: translateX(100vw) translateY(-50px) rotate(360deg);
              opacity: 0;
            }
          }
        `
      }} />
    </div>
  );
};