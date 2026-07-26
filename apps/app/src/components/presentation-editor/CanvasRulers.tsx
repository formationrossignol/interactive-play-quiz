interface CanvasRulersProps {
  width: number;
  height: number;
  zoom: number;
}

const STEP = 80;

export function CanvasRulers({ width, height, zoom }: CanvasRulersProps) {
  const xLabels = Array.from({ length: Math.floor(width / STEP) + 1 }, (_, index) => index);
  const yLabels = Array.from({ length: Math.floor(height / STEP) + 1 }, (_, index) => index);
  const scaledStep = STEP * zoom;

  return (
    <div
      aria-hidden="true"
      style={{ position: "sticky", top: 0, left: 0, width: "100%", height: 0, zIndex: 30, pointerEvents: "none" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          width: "100%",
          height: 32,
          overflow: "hidden",
          borderBottom: "1px solid var(--ap-line-2)",
          color: "var(--ap-muted)",
          backgroundColor: "var(--ap-paper-2)",
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0, transparent calc(20px - 1px), var(--ap-line-2) calc(20px - 1px), var(--ap-line-2) 20px)",
          backgroundSize: `${Math.max(4, scaledStep / 4)}px 9px`,
          backgroundPosition: "left bottom",
          backgroundRepeat: "repeat-x",
          zIndex: 30,
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 0, width: width * zoom, height: "100%", transform: "translateX(-50%)" }}>
          {xLabels.map((label) => (
            <span key={label} style={{ position: "absolute", left: label * scaledStep + 4, top: 4, fontFamily: "var(--ap-font-mono)", fontSize: 10, fontWeight: 700 }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 32,
          width: 32,
          height: "calc(100vh - 150px)",
          overflow: "hidden",
          borderRight: "1px solid var(--ap-line-2)",
          color: "var(--ap-muted)",
          backgroundColor: "var(--ap-paper-2)",
          backgroundImage: "repeating-linear-gradient(180deg, transparent 0, transparent calc(20px - 1px), var(--ap-line-2) calc(20px - 1px), var(--ap-line-2) 20px)",
          backgroundSize: `9px ${Math.max(4, scaledStep / 4)}px`,
          backgroundPosition: "right top",
          backgroundRepeat: "repeat-y",
          zIndex: 31,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: "50%", width: "100%", height: height * zoom, transform: "translateY(-50%)" }}>
          {yLabels.map((label) => (
            <span key={label} style={{ position: "absolute", top: label * scaledStep + 4, left: 5, fontFamily: "var(--ap-font-mono)", fontSize: 10, fontWeight: 700 }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: 32, height: 32, background: "var(--ap-paper-2)", borderRight: "1px solid var(--ap-line-2)", borderBottom: "1px solid var(--ap-line-2)", zIndex: 32 }} />
    </div>
  );
}
