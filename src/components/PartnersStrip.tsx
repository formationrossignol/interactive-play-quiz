import { useEffect, useState } from "react";
import { fetchPartners, type Partner } from "@/lib/siteSettings";

/** Trust band — fixed headline on the left, logos auto-scroll on the
 *  right (grayed out, colored on hover). Own band, visually decoupled
 *  from the footer. Content is entirely admin-managed
 *  (site_settings.partners_logos). Renders nothing until at least one
 *  partner is configured, on every theme. */
export const PartnersStrip = () => {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPartners().then((p) => { if (!cancelled) setPartners(p); });
    return () => { cancelled = true; };
  }, []);

  if (partners.length === 0) return null;

  // Below this count, an infinite-scroll loop is too short to read as
  // motion — it just replays the same handful of logos, which looks like a
  // glitch rather than social proof. A static row is honest at low counts;
  // the marquee only earns its keep once there's enough to actually scroll.
  const MARQUEE_MIN_PARTNERS = 5;
  const isMarquee = partners.length >= MARQUEE_MIN_PARTNERS;

  const renderLogo = (p: Partner) => {
    const img = <img src={p.logoUrl} alt={p.name} loading="lazy" />;
    return (
      <span className="ap-partners__logo" key={p.id} title={p.name}>
        {p.link ? (
          <a href={p.link} target="_blank" rel="noopener noreferrer" aria-label={p.name}>
            {img}
          </a>
        ) : (
          img
        )}
      </span>
    );
  };

  const logos = <span className="ap-partners__set">{partners.map(renderLogo)}</span>;

  return (
    <section className="ap-partners" aria-label="Partenaires">
      <div className="ap-partners__inner">
        <div className="ap-partners__intro">
          <h2 className="ap-partners__title">Ils nous font confiance</h2>
          <p className="ap-partners__sub">Alors pourquoi pas vous&nbsp;?</p>
        </div>
        {isMarquee ? (
          <div className="ap-partners__viewport">
            <div className="ap-partners__track">
              {logos}
              {logos}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 48 }}>
            {partners.map(renderLogo)}
          </div>
        )}
      </div>
    </section>
  );
};
