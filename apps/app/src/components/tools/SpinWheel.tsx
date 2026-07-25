import { useRef, useState } from "react";

// Cycles through the app's existing content-type accent tokens — already
// themed per site skin (Arcade Pop, Material 3, Thales, ...), so the wheel
// never needs its own hardcoded palette.
const SEGMENT_COLORS = [
  "var(--ap-quiz)",
  "var(--ap-poll)",
  "var(--ap-flash)",
  "var(--ap-pres)",
  "var(--ap-brand)",
];

const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 6;

interface SpinWheelProps {
  items: string[];
  disabled?: boolean;
  onResult: (item: string, index: number) => void;
}

export const SpinWheel = ({ items, disabled, onResult }: SpinWheelProps) => {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingWinnerRef = useRef<{ item: string; index: number } | null>(null);

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
          const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
          return `${color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`;
        })
        .join(", ")})`
    : "var(--ap-paper-2)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: "min(360px, 80vw)", height: "min(360px, 80vw)" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -4,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "22px solid var(--ap-ink)",
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
            background: gradient,
            border: "var(--ap-border-w) solid var(--ap-ink)",
            boxShadow: "var(--ap-shadow-card)",
            position: "relative",
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.72, 0.14, 1)` : undefined,
          }}
        >
          {items.map((item, i) => {
            const bisector = i * segAngle + segAngle / 2;
            return (
              <div
                key={`${item}-${i}`}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "50%",
                  height: 0,
                  transformOrigin: "0 0",
                  transform: `rotate(${bisector}deg)`,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 16,
                    top: -8,
                    maxWidth: 96,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                  }}
                >
                  {item}
                </span>
              </div>
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
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--ap-ink)",
            border: "3px solid var(--ap-paper)",
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
