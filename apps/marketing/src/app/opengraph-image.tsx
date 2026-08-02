import { ImageResponse } from "next/og";

export const alt = "Brivia — du direct aux résultats, un seul rythme";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", color: "#f8f7ff", background: "#0d0c16", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", width: 640, height: 640, borderRadius: 999, right: -130, top: -280, background: "radial-gradient(circle, rgba(123,114,241,.52), rgba(123,114,241,0) 68%)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
        <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 17, background: "#7168e8", fontSize: 30, fontWeight: 800 }}>b</div>
        Brivia
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 880 }}>
        <div style={{ display: "flex", color: "#aaa4f5", fontSize: 18, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>Participation · apprentissage · évaluation</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 76, fontWeight: 720, letterSpacing: -5, lineHeight: 1.02 }}>Du direct aux résultats, un seul rythme.</div>
      </div>
    </div>,
    size,
  );
}
