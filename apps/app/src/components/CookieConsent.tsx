import { useEffect, useRef, useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import type { CookieConsentState } from "@/lib/cookieConsent";
import { marketingUrl } from "@/lib/marketingOrigin";
import styles from "./CookieConsent.module.css";

const OPTIONAL_CATEGORIES: { key: Exclude<keyof CookieConsentState, "necessary">; title: string; desc: string }[] = [
  {
    key: "preferences",
    title: "Préférences",
    desc: "Mémorisent vos choix d'affichage (langue, thème) pour ne pas vous les redemander à chaque visite.",
  },
  {
    key: "analytics",
    title: "Analytics",
    desc: "Nous aideraient à mesurer l'audience et l'usage du site. Aucun cookie de ce type n'est déposé pour l'instant.",
  },
  {
    key: "marketing",
    title: "Marketing",
    desc: "Permettraient de personnaliser des messages publicitaires. Aucun cookie de ce type n'est déposé pour l'instant.",
  },
];

/** Mounted once at the app root — renders the bottom consent bar on first
 *  visit and the full preferences modal on demand (footer "Gérer les
 *  cookies" link reopens it at any time). */
export const CookieConsent = () => {
  const {
    consent,
    bannerVisible,
    preferencesOpen,
    openPreferences,
    closePreferences,
    acceptAll,
    rejectAll,
    savePreferences,
  } = useCookieConsent();

  const [draft, setDraft] = useState<CookieConsentState>(consent);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!preferencesOpen) return;

    setDraft(consent);
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreferences();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [preferencesOpen, consent, closePreferences]);

  if (!bannerVisible && !preferencesOpen) return null;

  return (
    <>
      {bannerVisible && !preferencesOpen && (
        <div className={styles.banner} role="dialog" aria-label="Gestion des cookies">
          <p className={styles.bannerText}>
            Nous utilisons des cookies nécessaires au bon fonctionnement du site. Avec votre accord, nous
            pourrons aussi utiliser des cookies de préférence, de mesure d'audience et marketing.{" "}
            <a href={marketingUrl("/confidentialite")}>En savoir plus</a>
          </p>
          <div className={styles.bannerActions}>
            <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={rejectAll}>
              Tout refuser
            </button>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={openPreferences}>
              Personnaliser
            </button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={acceptAll}>
              Tout accepter
            </button>
          </div>
        </div>
      )}

      {preferencesOpen && (
        <div className={styles.scrim}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            aria-describedby="cookie-preferences-description"
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.title} id="cookie-preferences-title">Gérer les cookies</h2>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={closePreferences}
              >
                Fermer
              </button>
            </div>
            <p className={styles.intro} id="cookie-preferences-description">
              Choisissez les cookies que vous autorisez. Vous pouvez revenir sur ce choix à tout moment
              depuis le lien « Gérer les cookies » en pied de page.
            </p>

            <div className={styles.preferenceList}>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <h3>Nécessaires</h3>
                  <p>Indispensables au fonctionnement du service (session, authentification, sécurité). Toujours actifs.</p>
                </div>
                <button
                  type="button"
                  className={styles.switch}
                  role="switch"
                  aria-checked="true"
                  disabled
                  aria-label="Cookies nécessaires, toujours actifs"
                />
              </div>

              {OPTIONAL_CATEGORIES.map(({ key, title, desc }) => (
                <div className={styles.row} key={key}>
                  <div className={styles.rowText}>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.switch}
                    role="switch"
                    aria-checked={draft[key]}
                    aria-label={title}
                    onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                  />
                </div>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={rejectAll}>
                Tout refuser
              </button>
              <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={acceptAll}>
                Tout accepter
              </button>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => savePreferences(draft)}>
                Enregistrer mes choix
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
