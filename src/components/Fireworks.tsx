import type { CSSProperties } from "react";

const BURSTS = [
  { x: 18, y: 14, color: '#ffb020', delay: 0,   size: 80 },
  { x: 78, y: 18, color: '#7048ff', delay: 0.5,  size: 72 },
  { x: 50, y: 8,  color: '#ff5a4d', delay: 1.1,  size: 90 },
  { x: 12, y: 44, color: '#15c08a', delay: 1.6,  size: 65 },
  { x: 87, y: 38, color: '#2f7bff', delay: 0.9,  size: 76 },
  { x: 38, y: 22, color: '#ffb020', delay: 1.9,  size: 68 },
  { x: 66, y: 11, color: '#ff5a4d', delay: 0.3,  size: 84 },
  { x: 55, y: 32, color: '#7048ff', delay: 1.3,  size: 70 },
];
const SPOKES = 12;
const PERIOD  = 2.4; // seconds between repeats

export const Fireworks = () => (
  <>
    <style>{`
      @keyframes burst-spoke {
        0%   { transform: rotate(var(--a)) translateY(0)            scale(1);   opacity: 1; }
        70%  { opacity: 0.7; }
        100% { transform: rotate(var(--a)) translateY(var(--d))     scale(0.1); opacity: 0; }
      }
      @keyframes burst-glow {
        0%,10% { opacity: 0; transform: scale(0); }
        18%    { opacity: 1; transform: scale(1); }
        80%    { opacity: 0.9; }
        100%   { opacity: 0; transform: scale(1.1); }
      }
    `}</style>

    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {BURSTS.map((b, bi) =>
        Array.from({ length: SPOKES }, (_, i) => {
          const angle = (360 / SPOKES) * i;
          const spokeDuration = 1.4;
          const loopDelay  = b.delay + i * 0.03;
          return (
            <div
              key={`${bi}-${i}`}
              style={{
                position: 'absolute',
                left: `${b.x}%`,
                top:  `${b.y}%`,
                width:  4,
                height: b.size / 2.5,
                background: b.color,
                borderRadius: '2px 2px 0 0',
                transformOrigin: '50% 100%',
                ['--a' as string]: `${angle}deg`,
                ['--d' as string]: `-${b.size}px`,
                animation: `burst-spoke ${spokeDuration}s ease-out ${loopDelay}s infinite`,
                animationIterationCount: 'infinite',
              } as CSSProperties}
            />
          );
        })
      )}

      {/* Central flash per burst */}
      {BURSTS.map((b, bi) => (
        <div
          key={`glow-${bi}`}
          style={{
            position: 'absolute',
            left:   `${b.x}%`,
            top:    `${b.y}%`,
            width:  20,
            height: 20,
            marginLeft: -10,
            marginTop:  -10,
            borderRadius: '50%',
            background: b.color,
            boxShadow: `0 0 18px 6px ${b.color}`,
            animation: `burst-glow ${PERIOD}s ease-out ${b.delay}s infinite`,
          } as CSSProperties}
        />
      ))}
    </div>
  </>
);
