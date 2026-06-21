import type { CSSProperties } from "react";

const BURSTS = [
  // top strip
  { x: 8,  y: 10, color: '#ffb020', delay: 0,    size: 110 },
  { x: 22, y: 6,  color: '#ff5a4d', delay: 0.7,  size: 130 },
  { x: 38, y: 12, color: '#7048ff', delay: 1.4,  size: 120 },
  { x: 50, y: 5,  color: '#15c08a', delay: 0.3,  size: 140 },
  { x: 63, y: 9,  color: '#2f7bff', delay: 1.0,  size: 115 },
  { x: 78, y: 7,  color: '#ffb020', delay: 0.5,  size: 125 },
  { x: 91, y: 13, color: '#ff5a4d', delay: 1.7,  size: 105 },
  // mid strip
  { x: 5,  y: 38, color: '#7048ff', delay: 1.2,  size: 95  },
  { x: 17, y: 44, color: '#15c08a', delay: 0.4,  size: 100 },
  { x: 83, y: 40, color: '#2f7bff', delay: 0.9,  size: 95  },
  { x: 95, y: 35, color: '#ffb020', delay: 1.5,  size: 105 },
  // sides
  { x: 3,  y: 22, color: '#ff5a4d', delay: 0.8,  size: 90  },
  { x: 96, y: 20, color: '#7048ff', delay: 1.3,  size: 90  },
  // center top
  { x: 50, y: 22, color: '#ffb020', delay: 2.0,  size: 150 },
  { x: 30, y: 30, color: '#ff5a4d', delay: 1.6,  size: 85  },
  { x: 70, y: 28, color: '#15c08a', delay: 0.6,  size: 85  },
];

const SPOKES = 16;
const PERIOD  = 2.2;

export const Fireworks = () => (
  <>
    <style>{`
      @keyframes burst-spoke {
        0%   { transform: rotate(var(--a)) translateY(0)        scale(1);   opacity: 1; }
        65%  { opacity: 0.8; }
        100% { transform: rotate(var(--a)) translateY(var(--d)) scale(0.1); opacity: 0; }
      }
      @keyframes burst-glow {
        0%,8%  { opacity: 0; transform: scale(0); }
        16%    { opacity: 1; transform: scale(1); }
        75%    { opacity: 0.85; }
        100%   { opacity: 0; transform: scale(1.15); }
      }
    `}</style>

    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {BURSTS.map((b, bi) =>
        Array.from({ length: SPOKES }, (_, i) => {
          const angle = (360 / SPOKES) * i;
          const spokeDuration = 1.5;
          const loopDelay = b.delay + i * 0.02;
          return (
            <div
              key={`${bi}-${i}`}
              style={{
                position: 'absolute',
                left: `${b.x}%`,
                top:  `${b.y}%`,
                width:  5,
                height: b.size / 2.2,
                background: b.color,
                borderRadius: '2px 2px 0 0',
                transformOrigin: '50% 100%',
                ['--a' as string]: `${angle}deg`,
                ['--d' as string]: `-${b.size}px`,
                animation: `burst-spoke ${spokeDuration}s ease-out ${loopDelay}s infinite`,
              } as CSSProperties}
            />
          );
        })
      )}

      {BURSTS.map((b, bi) => (
        <div
          key={`glow-${bi}`}
          style={{
            position: 'absolute',
            left:   `${b.x}%`,
            top:    `${b.y}%`,
            width:  26,
            height: 26,
            marginLeft: -13,
            marginTop:  -13,
            borderRadius: '50%',
            background: b.color,
            boxShadow: `0 0 24px 10px ${b.color}`,
            animation: `burst-glow ${PERIOD}s ease-out ${b.delay}s infinite`,
          } as CSSProperties}
        />
      ))}
    </div>
  </>
);
