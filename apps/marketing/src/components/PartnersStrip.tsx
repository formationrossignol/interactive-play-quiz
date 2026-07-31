import Image from "next/image";
import type { Partner } from "@/lib/types";
import styles from "./PartnersStrip.module.css";

export const PartnersStrip = ({ partners }: { partners: Partner[] }) => {
  if (partners.length === 0) return null;

  return (
    <section className={styles.partners} aria-label="Partenaires Brivia">
      <div className={styles.logoGrid}>
        {partners.map((partner) => {
          const logo = (
            <Image
              src={partner.logoUrl}
              alt={partner.name}
              fill
              sizes="144px"
              unoptimized
              style={{ objectFit: "contain" }}
            />
          );

          return partner.link ? (
            <a
              key={partner.id}
              href={partner.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={partner.name}
            >
              {logo}
            </a>
          ) : (
            <span key={partner.id}>{logo}</span>
          );
        })}
      </div>
    </section>
  );
};
