"use client";

import { useState } from "react";
import { submitReview, requireAuth } from "@/lib/interactionsRepo";
import type { Review, ReviewPersona } from "@/lib/types";
import pageStyles from "./MarketingPage.module.css";
import styles from "./ReviewsView.module.css";

type Persona = "all" | ReviewPersona;

const FILTERS: { value: Persona; label: string }[] = [
  { value: "all", label: "Tous les avis" },
  { value: "formateur", label: "Formateurs" },
  { value: "enseignant", label: "Enseignants" },
  { value: "entreprise", label: "Écoles et entreprises" },
];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ReviewsView({ reviews }: { reviews: Review[] }) {
  const [persona, setPersona] = useState<Persona>("all");
  const [reviewPersona, setReviewPersona] = useState<ReviewPersona>("formateur");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewRole, setReviewRole] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const visible = reviews.filter((review) => persona === "all" || review.p === persona);

  const onSubmitReview = async () => {
    if (!reviewText.trim() || pending) return;
    if (!(await requireAuth())) return;
    setPending(true);
    try {
      await submitReview({
        persona: reviewPersona,
        stars: reviewStars,
        text: reviewText.trim(),
        authorRole: reviewRole.trim(),
      });
      setSent(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <section className={pageStyles.section} aria-labelledby="published-reviews-title">
        <div className={pageStyles.container}>
          <div className={pageStyles.sectionLead}>
            <h2 id="published-reviews-title">Des retours publiés, sans chiffre inventé.</h2>
            <p>Filtrez les avis disponibles selon le contexte d’utilisation.</p>
          </div>

          <div className={styles.toolbar} role="group" aria-label="Filtrer les témoignages">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`${styles.filter} ${persona === filter.value ? styles.filterActive : ""}`}
                onClick={() => setPersona(filter.value)}
                aria-pressed={persona === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {visible.length > 0 ? (
            <div className={pageStyles.quoteGrid}>
              {visible.map((review) => (
                <figure className={pageStyles.quote} key={review.id}>
                  <div className={styles.stars} aria-label={`${review.stars} étoiles sur 5`}>
                    {"★★★★★".slice(0, review.stars)}
                  </div>
                  <blockquote>{review.text}</blockquote>
                  <figcaption>
                    <span className={pageStyles.initials} aria-hidden="true">
                      {getInitials(review.name)}
                    </span>
                    <span>
                      <strong>{review.name}</strong>
                      <small>{review.role}</small>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className={pageStyles.emptyState}>
              Aucun avis publié pour ce filtre.
            </div>
          )}
        </div>
      </section>

      <section className={`${pageStyles.section} ${pageStyles.sectionTint}`} aria-labelledby="share-review-title">
        <div className={`${pageStyles.container} ${styles.formSection}`}>
          <div className={styles.formIntro}>
            <h2 id="share-review-title">Partagez votre expérience.</h2>
            <p>Les avis sont relus avant publication. La connexion permet de vérifier qu’ils viennent bien d’un utilisateur.</p>
          </div>

          <div className={styles.form}>
            {sent ? (
              <p className={styles.success}>Merci. Votre avis sera publié après modération.</p>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="review-persona">Votre contexte</label>
                  <select
                    id="review-persona"
                    value={reviewPersona}
                    onChange={(event) => setReviewPersona(event.target.value as ReviewPersona)}
                  >
                    <option value="formateur">Formateur</option>
                    <option value="enseignant">Enseignant</option>
                    <option value="entreprise">École ou entreprise</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label id="review-rating-label">Votre note</label>
                  <div className={styles.ratingButtons} role="group" aria-labelledby="review-rating-label">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={rating <= reviewStars ? styles.selected : undefined}
                        onClick={() => setReviewStars(rating)}
                        aria-label={`${rating} étoiles`}
                        aria-pressed={rating === reviewStars}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="review-role">Votre rôle</label>
                  <input
                    id="review-role"
                    value={reviewRole}
                    onChange={(event) => setReviewRole(event.target.value)}
                    placeholder="Par exemple : formatrice indépendante"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="review-text">Votre témoignage</label>
                  <textarea
                    id="review-text"
                    rows={5}
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="Qu’est-ce qui a changé dans vos sessions ?"
                  />
                </div>

                <button
                  type="button"
                  className={styles.submit}
                  disabled={pending || !reviewText.trim()}
                  onClick={onSubmitReview}
                >
                  {pending ? "Envoi en cours…" : "Envoyer mon avis"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
