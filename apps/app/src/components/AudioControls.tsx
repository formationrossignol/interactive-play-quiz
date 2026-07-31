import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MaterialSymbol } from '@/components/MaterialSymbol';
import type { GameAudioApi } from '@/hooks/useGameAudio';

interface AudioControlsProps {
  audio: GameAudioApi;
  className?: string;
  expanded?: boolean;
}

/** Per-device sound controls. The expanded lobby version keeps the volume
 * visible; compact in-game headers expose it through an explicit disclosure. */
export const AudioControls = ({ audio, className, expanded = false }: AudioControlsProps) => {
  const [open, setOpen] = useState(false);
  const volumeLabel = `${Math.round(audio.volume * 100)} %`;

  const slider = (
    <label className="live-audio-slider">
      <span>Volume</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={audio.volume}
        onChange={(event) => audio.setVolume(Number(event.target.value))}
        aria-label="Volume du quiz"
      />
      <output>{volumeLabel}</output>
    </label>
  );

  return (
    <div className={cn('live-audio-controls', expanded && 'live-audio-controls--expanded', className)}>
      <button
        type="button"
        onClick={() => audio.setMuted(!audio.muted)}
        title={audio.muted ? 'Activer le son' : 'Couper le son'}
        aria-label={audio.muted ? 'Activer le son' : 'Couper le son'}
        aria-pressed={audio.muted}
        className="live-audio-toggle"
      >
        <MaterialSymbol name={audio.muted ? 'volume_off' : 'volume_up'} size={20} filled />
        {expanded && <span>{audio.muted ? 'Son coupé' : 'Son activé'}</span>}
      </button>

      {expanded ? slider : (
        <>
          <button
            type="button"
            className="live-audio-disclosure"
            onClick={() => setOpen((value) => !value)}
            aria-label="Régler le volume"
            aria-expanded={open}
          >
            <MaterialSymbol name={open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={20} />
          </button>
          {open && <div className="live-audio-popover">{slider}</div>}
        </>
      )}
    </div>
  );
};
