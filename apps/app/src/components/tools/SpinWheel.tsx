import { useId, useRef, useState } from "react";

// Validated categorical palette (8 hues, adjacent-pair CVD-safe) — decorative
// wheel segments aren't tied to app content-type semantics like --ap-quiz/
// --ap-poll, so a dedicated fixed palette (light/dark pair) fits better than
// reusing the 5-token brand accent set, which collides once a wheel has more
// items than tokens.
const PALETTE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const PALETTE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 6;
const GAP_DEG = 0.6;
const LABEL_RADIUS_PCT = 35;

/** Palette slot for segment i. On wraparound (last item adjacent to item 0),
 *  bump by one slot if they'd otherwise land on the same color. */
const paletteSlot = (i: number, total: number) => {
  const n = PALETTE_LIGHT.length;
  let idx = i % n;
  if (i === total - 1 && total > n && idx === 0) idx = 1 % n;
  return idx;
};

interface SpinWheelProps {
  items: string[];
  disabled?: boolean;
  onResult: (item: string, index: number) => void;
}

export const SpinWheel = ({ items, disabled, onResult }: SpinWheelProps) => {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingWinnerRef = useRef<{ item: string; index: number } | null>(null);
  const scopeClass = `wheel-${useId().replace(/[:]/g, "")}`;

  const segAngle = items.length > 0 ? 360 / items.length : 0;

  const spin = () => {
    if (spinning || disabled || items.length < 2) return;

    const winnerIndex = Math.floor(Math.random() * items.length);
    const winnerCenter = winnerIndex * segAngle + segAngle / 2;
    // Jitter within the segment so the pointer doesn't land dead-center every time.
    const jitterRange = Math.max(segAngle * 0.35 - 5, 0);
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    const finalAngleMod = ((360 - winnerCenter + jitter) % 360 + 360) % 360;

    const base = Math.ceil(rotation / 360) * 360;
    let target = base + 360 * EXTRA_SPINS + finalAngleMod;
    if (target <= rotation) target += 360;

    pendingWinnerRef.current = { item: items[winnerIndex], index: winnerIndex };
    setSpinning(true);
    setRotation(target);
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    setSpinning(false);
    const winner = pendingWinnerRef.current;
    pendingWinnerRef.current = null;
    if (winner) onResult(winner.item, winner.index);
  };

  const gradient = items.length
    ? `conic-gradient(${items
        .map((_, i) => {
          const colorVar = `var(--wheel-c${paletteSlot(i, items.length)})`;
          const start = i * segAngle + GAP_DEG / 2;
          const end = (i + 1) * segAngle - GAP_DEG / 2;
          return `${colorVar} ${start}deg ${end}deg`;
        })
        .join(", ")})`
    : "var(--ap-paper-2)";

  return (
    <div className={scopeClass} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <style>{`
        .${scopeClass} { ${PALETTE_LIGHT.map((c, i) => `--wheel-c${i}: ${c};`).join(" ")} }
        .dark .${scopeClass} { ${PALETTE_DARK.map((c, i) => `--wheel-c${i}: ${c};`).join(" ")} }
      `}</style>

      <div style={{ position: "relative", width: "min(440px, 88vw)", height: "min(440px, 88vw)" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "16px solid transparent",
            borderRight: "16px solid transparent",
            borderTop: "26px solid var(--ap-ink)",
            zIndex: 2,
            filter: "drop-shadow(0 2px 0 var(--ap-paper))",
          }}
        />
        <div
          onTransitionEnd={handleTransitionEnd}
          role="img"
          aria-label={`Roue avec ${items.length} éléments`}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: `${gradient}, var(--ap-paper)`,
            border: "3px solid var(--ap-ink)",
            boxShadow: "0 18px 40px -12px rgba(0,0,0,0.35), var(--ap-shadow-card)",
            position: "relative",
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.72, 0.14, 1)` : undefined,
          }}
        >
          {items.map((item, i) => {
            const bisector = i * segAngle + segAngle / 2;
            const flip = bisector > 90 && bisector < 270;
            // Polar → percentage position (0deg = top, clockwise), so the
            // label sits at a fixed radius regardless of the wheel's
            // responsive pixel size.
            const theta = ((90 - bisector) * Math.PI) / 180;
            const left = 50 + LABEL_RADIUS_PCT * Math.cos(theta);
            const top = 50 - LABEL_RADIUS_PCT * Math.sin(theta);

            return (
              <span
                key={`${item}-${i}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `translate(-50%, -50%) rotate(${flip ? bisector + 180 : bisector}deg)`,
                  display: "block",
                  width: 118,
                  textAlign: "center",
                  fontSize: "clamp(14px, 3.6vw, 19px)",
                  fontWeight: 800,
                  fontFamily: "var(--ap-font-display)",
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  lineHeight: 1.15,
                  overflowWrap: "break-word",
                  pointerEvents: "none",
                }}
              >
                {item}
              </span>
            );
          })}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--ap-ink)",
            border: "4px solid var(--ap-paper)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 2,
          }}
        />
      </div>

      <button
        type="button"
        className="ap-btn ap-btn--lg"
        onClick={spin}
        disabled={disabled || spinning || items.length < 2}
      >
        {spinning ? "Ça tourne..." : "Lancer la roue"}
      </button>
    </div>
  );
};
