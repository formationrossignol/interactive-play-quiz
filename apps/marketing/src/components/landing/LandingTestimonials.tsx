import type { Review } from "@/lib/types";

const stars = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);

/** Mirrors apps/app/src/components/landing/LandingTestimonials.tsx, server-
 *  rendered: reviews are fetched once in page.tsx and passed down. Renders
 *  an honest empty state instead of a placeholder name/quote. */
export const LandingTestimonials = ({ reviews }: { reviews: Review[] }) => {
  const top = reviews.slice(0, 3);

  if (top.length === 0) {
    return (
      <div className="ap-card" style={{ textAlign: "center", padding: "40px 28px" }}>
        <p className="ap-muted" style={{ marginBottom: 16 }}>Les premiers avis arriveront bientôt ici.</p>
        <a className="ap-btn ap-btn--ghost ap-btn--pill ap-btn--sm" href="/reviews">
          Voir les avis
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
      {top.map((r) => (
        <div className="ap-card ap-card--hover" key={r.id} style={{ padding: "22px 24px" }}>
          <div style={{ color: "var(--ap-brand)", fontSize: 14, marginBottom: 10 }}>{stars(r.stars)}</div>
          <p style={{ fontSize: 14, color: "var(--ap-ink)", lineHeight: 1.55, marginBottom: 16 }}>{r.text}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{r.av}</span>
            <div>
              <div style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 13.5, color: "var(--ap-ink)" }}>{r.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ap-muted)" }}>{r.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
