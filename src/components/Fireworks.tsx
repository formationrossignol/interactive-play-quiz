import { useEffect, useRef } from "react";

const COLORS = ['#ffb020', '#ff5a4d', '#7048ff', '#2f7bff', '#15c08a', '#ffffff'];

type Rocket = { x: number; y: number; vy: number; ty: number; c: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; c: string };

export const Fireworks = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;

    let parts: Particle[] = [];
    let rockets: Rocket[] = [];
    let running = false;
    let rafId = 0;

    const fit = () => { cv.width = window.innerWidth; cv.height = window.innerHeight; };
    fit();
    window.addEventListener('resize', fit);

    const launch = (n = 1) => {
      for (let i = 0; i < n; i++) {
        rockets.push({
          x: window.innerWidth * (0.2 + Math.random() * 0.6),
          y: window.innerHeight + 10,
          vy: -(9 + Math.random() * 4),
          ty: window.innerHeight * (0.16 + Math.random() * 0.3),
          c: COLORS[(Math.random() * COLORS.length) | 0],
        });
      }
    };

    const explode = (x: number, y: number, c: string) => {
      const N = 42 + ((Math.random() * 26) | 0);
      for (let i = 0; i < N; i++) {
        const a = (Math.PI * 2 * i) / N + Math.random() * 0.2;
        const v = 2 + Math.random() * 3.6;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.8 ? c : '#fff' });
      }
    };

    const frame = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      rockets = rockets.filter(r => {
        r.y += r.vy;
        ctx.fillStyle = r.c;
        ctx.fillRect(r.x - 1.5, r.y, 3, 9);
        if (r.y <= r.ty) { explode(r.x, r.y, r.c); return false; }
        return true;
      });
      parts = parts.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.vx *= 0.985; p.life -= 0.013;
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
      if (running || parts.length || rockets.length) rafId = requestAnimationFrame(frame);
    };

    running = true;
    launch(3);
    const t1 = setTimeout(() => launch(2), 350);
    const t2 = setTimeout(() => launch(2), 800);
    frame();
    const ambient = setInterval(() => launch(1), 2600);
    const t3 = setTimeout(() => { clearInterval(ambient); running = false; }, 12000);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearInterval(ambient); cancelAnimationFrame(rafId);
      window.removeEventListener('resize', fit);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
    />
  );
};
