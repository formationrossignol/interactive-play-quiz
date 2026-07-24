import type { Partner } from "@/lib/types";

/** Mirrors apps/app/src/components/PartnersStrip.tsx, but server-rendered:
 *  partners are fetched once in page.tsx (fetchPartners) and passed down,
 *  rather than fetched client-side on mount. No client interactivity here
 *  beyond the CSS :hover pause, so no 'use client' needed. */
export const PartnersStrip = ({ partners }: { partners: Partner[] }) => {
  if (partners.length === 0) return null;

  const logos = (
    <span className="ap-partners__set">
      {partners.map((p) => {
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
      })}
    </span>
  );

  return (
    <section className="ap-partners" aria-label="Partenaires">
      <div className="ap-partners__inner">
        <div className="ap-partners__intro">
          <h2 className="ap-partners__title">Ils nous font confiance</h2>
          <p className="ap-partners__sub">Alors pourquoi pas vous&nbsp;?</p>
        </div>
        <div className="ap-partners__viewport">
          <div className="ap-partners__track">
            {logos}
            {logos}
          </div>
        </div>
      </div>
    </section>
  );
};
