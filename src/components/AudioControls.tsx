// src/components/AudioControls.tsx
import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameAudioApi } from '@/hooks/useGameAudio';

interface AudioControlsProps {
  audio: GameAudioApi;
  className?: string;
}

// Per-device mute toggle + volume slider popover. Arcade Pop tokens, white-on-
// translucent to sit over the dark in-session backgrounds.
export const AudioControls = ({ audio, className }: AudioControlsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => audio.setMuted(!audio.muted)}
        onContextMenu={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={audio.muted ? 'Activer le son' : 'Couper le son'}
        aria-label={audio.muted ? 'Activer le son' : 'Couper le son'}
        className="ap-btn ap-btn--ghost ap-btn--sm"
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '2px solid rgba(255,255,255,0.2)',
          color: '#fff',
          boxShadow: 'none',
          padding: '8px 10px',
        }}
      >
        {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30,
            background: 'rgba(20,14,40,0.95)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '12px 14px', width: 160,
          }}
        >
          <input
            type="range" min={0} max={1} step={0.05}
            value={audio.volume}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
};
