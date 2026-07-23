/** Only the visitor count is real (Supabase presence channel, same source
 *  as the hero pill — passed down as a prop so both consumers share one
 *  channel subscription instead of opening a second one with the same
 *  topic name). A single live badge, not padded with invented stats — but
 *  given the same card weight as its neighbors (UseCaseTabs, testimonials)
 *  so the restraint reads as deliberate, not like missing content. */
export const StatsBand = ({ liveVisitors }: { liveVisitors: number | null }) => (
  <div style={{ display: "flex", justifyContent: "center" }}>
    <div className="ap-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 380, padding: "28px 32px", textAlign: "center" }}>
      <div className="ap-eyebrow" style={{ fontSize: 15 }}>
        <span className="ap-eyebrow__dot" aria-hidden="true" />
        {liveVisitors != null ? liveVisitors : "…"} visiteur{liveVisitors !== 1 ? "s" : ""} en direct sur le site
      </div>
      <p className="ap-muted" style={{ fontSize: 13, margin: 0 }}>Rejoignez-les et lancez votre première session.</p>
    </div>
  </div>
);
