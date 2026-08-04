import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import { fetchReviews } from "@/lib/repo";
import { fetchPartners } from "@/lib/siteSettings";
import styles from "@/components/TrustPages.module.css";

export const metadata: Metadata = {
  title: "Résultats et références",
  description: "Découvrez les retours publiés, les références autorisées et la méthode Brivia pour documenter un cas d’usage sans inventer de résultat.",
  alternates: { canonical: "/customers" },
};

const PROTOCOL = [
  {
    title: "Cadrer",
    text: "Le public, le format et le critère de réussite sont définis avant la session.",
  },
  {
    title: "Observer",
    text: "Les résultats quantitatifs restent séparés des retours qualitatifs.",
  },
  {
    title: "Publier",
    text: "La source, la date, le périmètre et les limites accompagnent chaque cas.",
  },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function CustomersPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const [reviews, partners] = await Promise.all([fetchReviews(), fetchPartners()]);
  const average = reviews.length
    ? (reviews.reduce((total, review) => total + review.stars, 0) / reviews.length).toFixed(1).replace(".", ",")
    : null;
  const featuredReviews = reviews.slice(0, 3);

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.proofPage}>
        <section className={styles.proofHero} aria-labelledby="proof-title">
          <Image
            src="/images/brivia-proof-review.png"
            alt="Deux professionnels analysent ensemble les résultats d’une session"
            fill
            priority
            sizes="100vw"
            className={styles.proofHeroImage}
          />
          <div className={styles.proofHeroShade} aria-hidden="true" />
          <div className={styles.proofHeroInner}>
            <p className={styles.proofEyebrow}>Résultats et références</p>
            <h1 id="proof-title">Les résultats avant les logos.</h1>
            <p>
              Brivia publie les voix, le contexte et la méthode. Une référence n’apparaît que lorsqu’elle peut être attribuée.
            </p>
            <div className={styles.proofHeroActions}>
              <Link className={styles.lightButton} href="#protocol-title" data-marketing-cta="customers_method">
                Voir la méthode <ProductGlyph name="arrow" />
              </Link>
              <Link className={styles.lightTextLink} href="/reviews" data-marketing-cta="customers_reviews">Lire tous les avis</Link>
            </div>
          </div>
        </section>

        <section className={styles.evidenceLedger} aria-label="Preuves actuellement publiées">
          <div>
            <span>Avis publics</span>
            <strong>{reviews.length}</strong>
            <small>modérés et attribués</small>
          </div>
          <div>
            <span>Note publiée</span>
            <strong>{average ?? "Non calculée"}</strong>
            <small>{average ? "sur 5" : "aucune moyenne sans avis"}</small>
          </div>
          {partners.length ? (
            <div>
              <span>Références autorisées</span>
              <strong>{partners.length}</strong>
              <small>logos publiés avec autorisation</small>
            </div>
          ) : (
            <Link href="/contact?intent=pilot">
              <span>Programme pilote</span>
              <strong>Ouvert</strong>
              <small>pour documenter le premier cas</small>
            </Link>
          )}
          <Link href="/security">
            <span>Dossier de confiance</span>
            <strong>Ouvert</strong>
            <small>contrôles et limites documentés</small>
          </Link>
        </section>

        <section className={styles.voicesSection} aria-labelledby="voices-title">
          <div className={styles.voicesHeading}>
            <h2 id="voices-title">Ce qui est publié aujourd’hui.</h2>
            <p>Pas de témoignage fabriqué, pas de résultat extrapolé. La page évolue avec les preuves réellement disponibles.</p>
          </div>

          {featuredReviews.length ? (
            <div className={styles.voiceGrid}>
              {featuredReviews.map((review, index) => (
                <figure className={index === 0 ? styles.featuredVoice : styles.voice} key={review.id}>
                  <div className={styles.voiceRating} aria-label={`${review.stars} étoiles sur 5`}>
                    {review.stars}/5
                  </div>
                  <blockquote>« {review.text} »</blockquote>
                  <figcaption>
                    <span aria-hidden="true">{initials(review.name)}</span>
                    <div><strong>{review.name}</strong><small>{review.role}</small></div>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className={styles.proofEmpty}>
              <strong>La première étude nominative reste à publier.</strong>
              <p>Nous préférons montrer une absence de preuve plutôt que remplir cet espace avec une citation fictive.</p>
              <Link href="/contact?intent=pilot">Construire un cas pilote</Link>
            </div>
          )}
        </section>

        {partners.length > 0 && (
          <section className={styles.referenceWall} aria-labelledby="references-title">
            <h2 id="references-title">Références autorisées</h2>
            <div className={styles.referenceLogos}>
              {partners.map((partner) => {
                const logo = <Image src={partner.logoUrl} alt={partner.name} fill sizes="180px" unoptimized />;
                return partner.link ? (
                  <a href={partner.link} target="_blank" rel="noopener noreferrer" key={partner.id}>{logo}</a>
                ) : <span key={partner.id}>{logo}</span>;
              })}
            </div>
          </section>
        )}

        <section className={styles.protocolSection} aria-labelledby="protocol-title">
          <div className={styles.protocolIntro}>
            <h2 id="protocol-title">Une étude de cas commence avant la session.</h2>
            <p>Le protocole évite qu’un bon souvenir soit présenté comme une preuve de performance.</p>
          </div>
          <div className={styles.protocolFlow}>
            {PROTOCOL.map((item) => (
              <article key={item.title}>
                <ProductGlyph name={item.title === "Cadrer" ? "controls" : item.title === "Observer" ? "analytics" : "check"} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <aside className={styles.methodNote}>
            <strong>Règle de publication</strong>
            <p>Nom, fonction et organisation nécessitent un accord. L’anonymat doit être expliqué. Les limites du test restent visibles.</p>
          </aside>
        </section>

        <section className={styles.proofClosing}>
          <div>
            <h2>Votre prochain pilote peut devenir une référence solide.</h2>
            <p>Nous cadrons le scénario, les indicateurs et les conditions de publication avec votre équipe.</p>
          </div>
          <Link href="/contact?intent=pilot" data-marketing-cta="customers_pilot">Proposer un pilote <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
