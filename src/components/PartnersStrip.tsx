import { useEffect, useState } from "react";
import { fetchPartners, type Partner } from "@/lib/siteSettings";

/** "Partenaires" band with an auto-scrolling logo row — content is entirely
 *  admin-managed (site_settings.partners_logos). Renders nothing until at
 *  least one partner is configured, on every theme. */
export const PartnersStrip = () => {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPartners().then((p) => { if (!cancelled) setPartners(p); });
    return () => { cancelled = true; };
  }, []);

  if (partners.length === 0) return null;

  // Logos are duplicated once so the CSS marquee can loop seamlessly at -50%.
  const track = [...partners, ...partners];

  return (
    <div className="ap-partners" aria-label="Partenaires">
      <p className="ap-partners__label">Partenaires</p>
      <div className="ap-partners__viewport">
        <div className="ap-partners__track" style={{ ["--ap-partners-count" as string]: partners.length }}>
          {track.map((p, i) => {
            const img = <img src={p.logoUrl} alt={p.name} loading="lazy" />;
            return (
              <span className="ap-partners__logo" key={`${p.id}-${i}`} title={p.name}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" aria-label={p.name}>
                    {img}
                  </a>
                ) : (
                  img
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
