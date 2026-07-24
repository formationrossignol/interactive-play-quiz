/** Mirrors apps/app/src/components/landing/DemoShowcase.tsx — placeholder
 *  for a real screen-capture GIF of a live session. Do not replace this box
 *  with a stock video or a fake screenshot in the meantime. */
export const DemoShowcase = () => (
  <div
    style={{
      aspectRatio: "16 / 9",
      width: "100%",
      borderRadius: "var(--ap-r-xl)",
      border: "2px dashed var(--ap-line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--ap-paper-2)",
    }}
  >
    <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 14, color: "var(--ap-muted)", letterSpacing: "0.02em" }}>
      GIF de démo à venir
    </span>
  </div>
);
