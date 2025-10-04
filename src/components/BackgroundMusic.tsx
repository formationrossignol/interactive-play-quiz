import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackgroundMusicProps {
  isPlaying: boolean;
  className?: string;
}

export const BackgroundMusic = ({ isPlaying, className }: BackgroundMusicProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element with a calm background music URL
    // Using a royalty-free calm music URL
    const audio = new Audio("https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && !isMuted) {
      audioRef.current.play().catch(err => console.log("Audio play failed:", err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  if (!isPlaying) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMute}
      className={cn("bg-white/10 hover:bg-white/20 text-white", className)}
    >
      {isMuted ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </Button>
  );
};
