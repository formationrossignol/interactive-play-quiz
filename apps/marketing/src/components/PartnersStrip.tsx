import Image from "next/image";
import type { Partner } from "@/lib/types";
import styles from "./PartnersStrip.module.css";

export const PartnersStrip = ({
  partners,
  language = "fr",
}: {
  partners: Partner[];
  language?: "fr" | "en";
}) => {
  if (partners.length === 0) return null;

  return (
    <section className={styles.partners} aria-labelledby="partners-title">
      <div className={styles.partnersInner}>
        <p id="partners-title" className={styles.partnerMessage}>
          {language === "en"
            ? "Learning teams choose Brivia to turn their audiences into active participants."
            : "Des équipes pédagogiques choisissent Brivia pour faire participer leurs groupes."}
        </p>

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
      </div>
    </section>
  );
};
