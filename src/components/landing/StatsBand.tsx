import { useLiveVisitors } from "@/hooks/useLiveVisitors";

/** Only the visitor count is real (Supabase presence channel, same source
 *  as the hero pill). The other two tiles are explicit placeholders — do
 *  not replace them with an invented number. */
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

export const StatsBand = () => {
  const liveVisitors = useLiveVisitors();

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

      {/* TODO: brancher une vraie requête Supabase (ex. nombre de quiz créés,
          nombre de sessions jouées) une fois qu'une requête d'agrégation
          existe côté backend — ne pas inventer de chiffre en attendant. */}
      <PlaceholderTile label="Bientôt disponible" />
      <PlaceholderTile label="Bientôt disponible" />
    </div>
  );
};
