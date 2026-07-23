/** Placeholder for a real screen-capture GIF of a live session — swap the
 *  commented <img> below for a real asset at /demo/product-demo.gif once
 *  one is recorded. Do not replace this box with a stock video or a fake
 *  screenshot in the meantime. */
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
    {/* <img src="/demo/product-demo.gif" alt="Démo d'une session Brivia en direct" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--ap-r-xl)" }} /> */}
    <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 14, color: "var(--ap-muted)", letterSpacing: "0.02em" }}>
      GIF de démo à venir
    </span>
  </div>
);
