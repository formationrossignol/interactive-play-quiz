import type { CSSProperties } from "react";

const BURSTS = [
  { x: 8,  y: 5,  color: '#FFD700', delay: 0.0,  size: 170 },
  { x: 50, y: 3,  color: '#ff5a4d', delay: 0.5,  size: 200 },
  { x: 92, y: 5,  color: '#7048ff', delay: 1.0,  size: 170 },
  { x: 25, y: 7,  color: '#15c08a', delay: 1.6,  size: 150 },
  { x: 75, y: 7,  color: '#2f7bff', delay: 0.8,  size: 150 },
  { x: 5,  y: 28, color: '#ffb020', delay: 1.3,  size: 130 },
  { x: 95, y: 28, color: '#ff5a4d', delay: 0.3,  size: 130 },
  { x: 38, y: 14, color: '#FFD700', delay: 2.1,  size: 140 },
  { x: 62, y: 14, color: '#15c08a', delay: 1.9,  size: 140 },
  { x: 15, y: 20, color: '#7048ff', delay: 2.4,  size: 110 },
  { x: 85, y: 20, color: '#ffb020', delay: 0.2,  size: 110 },
];

const SPOKES = 22;
const PERIOD = 2.8;

const GLITTER = BURSTS.map(b =>
  Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 12;
    const dist = 50 + (i * 8.7) % 55;
    return {
      gx: Math.cos(angle) * dist,
      gy: Math.sin(angle) * dist - 25,
      gr: (i * 41) % 360,
      dur: 1.3 + (i * 0.13) % 0.7,
    };
  })
);

export const Fireworks = () => (
  <>
    <style>{`
      @keyframes burst-spoke {
        0%   { transform: rotate(var(--a)) translateY(0) scale(1);    opacity: 1; }
        60%  { opacity: 0.8; }
        100% { transform: rotate(var(--a)) translateY(var(--d)) scale(0.05); opacity: 0; }
      }
      @keyframes burst-glow {
        0%,10% { opacity: 0; transform: scale(0); }
        22%    { opacity: 1; transform: scale(1); }
        72%    { opacity: 0.9; }
        100%   { opacity: 0; transform: scale(1.4); }
      }
      @keyframes glitter-fly {
        0%   { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--gx),var(--gy)) scale(0) rotate(var(--gr)); opacity: 0; }
      }
    `}</style>

    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {/* Spokes */}
      {BURSTS.map((b, bi) =>
        Array.from({ length: SPOKES }, (_, i) => {
          const angle = (360 / SPOKES) * i;
          const dur = 1.6 + (i * 0.07) % 0.5;
          return (
            <div
              key={`${bi}-${i}`}
              style={{
                position: 'absolute',
                left: `${b.x}%`, top: `${b.y}%`,
                width: 3,
                height: b.size / 2,
                background: `linear-gradient(to top, ${b.color} 0%, transparent 100%)`,
                borderRadius: '2px 2px 0 0',
                transformOrigin: '50% 100%',
                ['--a' as string]: `${angle}deg`,
                ['--d' as string]: `-${b.size * 1.5}px`,
                animation: `burst-spoke ${dur}s ease-out ${b.delay + i * 0.012}s infinite`,
              } as CSSProperties}
            />
          );
        })
      )}

      {/* Glow centers */}
      {BURSTS.map((b, bi) => (
        <div
          key={`glow-${bi}`}
          style={{
            position: 'absolute',
            left: `${b.x}%`, top: `${b.y}%`,
            width: 34, height: 34,
            marginLeft: -17, marginTop: -17,
            borderRadius: '50%',
            background: b.color,
            boxShadow: `0 0 32px 16px ${b.color}`,
            animation: `burst-glow ${PERIOD}s ease-out ${b.delay}s infinite`,
          } as CSSProperties}
        />
      ))}

      {/* Glitter particles */}
      {BURSTS.map((b, bi) =>
        GLITTER[bi].map((g, i) => (
          <div
            key={`g-${bi}-${i}`}
            style={{
              position: 'absolute',
              left: `${b.x}%`, top: `${b.y}%`,
              width: 6, height: 6,
              borderRadius: '50%',
              background: b.color,
              boxShadow: `0 0 5px 2px ${b.color}`,
              ['--gx' as string]: `${g.gx}px`,
              ['--gy' as string]: `${g.gy}px`,
              ['--gr' as string]: `${g.gr}deg`,
              animation: `glitter-fly ${g.dur}s ease-out ${b.delay + i * 0.07 + 0.12}s infinite`,
            } as CSSProperties}
          />
        ))
      )}
    </div>
  </>
);
