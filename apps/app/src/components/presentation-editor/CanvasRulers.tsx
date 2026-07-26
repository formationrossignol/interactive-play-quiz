interface CanvasRulersProps {
  width: number;
  height: number;
  zoom: number;
  offset: number;
}

const STEP = 80;

export function CanvasRulers({ width, height, zoom, offset }: CanvasRulersProps) {
  const xLabels = Array.from({ length: Math.floor(width / STEP) + 1 }, (_, index) => index);
  const yLabels = Array.from({ length: Math.floor(height / STEP) + 1 }, (_, index) => index);
  const scaledStep = STEP * zoom;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: offset,
          top: 0,
          width: width * zoom,
          height: offset,
          overflow: "hidden",
          borderBottom: "1px solid var(--ap-line-2)",
          color: "var(--ap-muted)",
          backgroundColor: "var(--ap-paper-2)",
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0, transparent calc(20px - 1px), var(--ap-line-2) calc(20px - 1px), var(--ap-line-2) 20px)",
          backgroundSize: `${Math.max(4, scaledStep / 4)}px 9px`,
          backgroundPosition: "left bottom",
          backgroundRepeat: "repeat-x",
        }}
      >
        {xLabels.map((label) => (
          <span key={label} style={{ position: "absolute", left: label * scaledStep + 4, top: 4, fontFamily: "var(--ap-font-mono)", fontSize: 10, fontWeight: 700 }}>
            {label}
          </span>
        ))}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: offset,
          width: offset,
          height: height * zoom,
          overflow: "hidden",
          borderRight: "1px solid var(--ap-line-2)",
          color: "var(--ap-muted)",
          backgroundColor: "var(--ap-paper-2)",
          backgroundImage: "repeating-linear-gradient(180deg, transparent 0, transparent calc(20px - 1px), var(--ap-line-2) calc(20px - 1px), var(--ap-line-2) 20px)",
          backgroundSize: `9px ${Math.max(4, scaledStep / 4)}px`,
          backgroundPosition: "right top",
          backgroundRepeat: "repeat-y",
        }}
      >
        {yLabels.map((label) => (
          <span key={label} style={{ position: "absolute", top: label * scaledStep + 4, left: 5, fontFamily: "var(--ap-font-mono)", fontSize: 10, fontWeight: 700 }}>
            {label}
          </span>
        ))}
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: offset, height: offset, background: "var(--ap-paper-2)", borderRight: "1px solid var(--ap-line-2)", borderBottom: "1px solid var(--ap-line-2)" }} />
    </>
  );
}
