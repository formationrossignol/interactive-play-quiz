"use client";

/** Mirrors apps/app/src/components/landing/StatsBand.tsx. Shares one
 *  presence-channel subscription between the hero pill and this band via a
 *  lifted liveVisitors prop — Supabase's channel() dedupes by topic, so two
 *  independent useLiveVisitors() calls for "live-visitors" collide on the
 *  same channel and the second .on() throws after the first subscribe().
 *  Only the visitor count is real; the other two tiles are explicit
 *  placeholders — do not replace them with an invented number. */
const PlaceholderTile = ({ label }: { label: string }) => (
  <div
    className="ap-card"
    style={{
      textAlign: "center", padding: "22px 18px",
      border: "2px dashed var(--ap-line)", background: "transparent", boxShadow: "none",
    }}
  >
    <div style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 32, color: "var(--ap-line-2)" }}>—</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 4 }}>{label}</div>
  </div>
);

export const StatsBand = ({ liveVisitors }: { liveVisitors: number | null }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="strip-grid">
      <div className="ap-card ap-card--hover" style={{ textAlign: "center", padding: "22px 18px" }}>
        <div style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 32, color: "var(--ap-brand)" }}>
          {liveVisitors != null ? liveVisitors : "…"}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 4 }}>
          🔴 visiteur{liveVisitors !== 1 ? "s" : ""} en direct sur le site
        </div>
      </div>

      <PlaceholderTile label="Bientôt disponible" />
      <PlaceholderTile label="Bientôt disponible" />
    </div>
  );
};
