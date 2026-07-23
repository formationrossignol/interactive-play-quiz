import { useEffect, useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import type { CookieConsentState } from "@/lib/cookieConsent";

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

  useEffect(() => {
    if (preferencesOpen) setDraft(consent);
  }, [preferencesOpen, consent]);

  if (!bannerVisible && !preferencesOpen) return null;

  return (
    <>
      {bannerVisible && !preferencesOpen && (
        <div className="ap-cookie-banner" role="dialog" aria-label="Gestion des cookies">
          <p className="ap-cookie-banner__text">
            Nous utilisons des cookies nécessaires au bon fonctionnement du site. Avec votre accord, nous
            pourrons aussi utiliser des cookies de préférence, de mesure d'audience et marketing.{" "}
            <a href="/confidentialite">En savoir plus</a>
          </p>
          <div className="ap-cookie-banner__actions">
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={rejectAll}>
              Tout refuser
            </button>
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={openPreferences}>
              Personnaliser
            </button>
            <button type="button" className="ap-btn ap-btn--sm" onClick={acceptAll}>
              Tout accepter
            </button>
          </div>
        </div>
      )}

      {preferencesOpen && (
        <div className="ap-cookie-modal__scrim" onClick={closePreferences}>
          <div
            className="ap-cookie-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Préférences de cookies"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="ap-cookie-modal__title">Gérer les cookies</h2>
            <p className="ap-cookie-modal__intro">
              Choisissez les cookies que vous autorisez. Vous pouvez revenir sur ce choix à tout moment
              depuis le lien « Gérer les cookies » en pied de page.
            </p>

            <div className="ap-cookie-modal__row">
              <div className="ap-cookie-modal__row-text">
                <h3>Nécessaires</h3>
                <p>Indispensables au fonctionnement du service (session, authentification, sécurité). Toujours actifs.</p>
              </div>
              <button
                type="button"
                className="ap-switch is-on"
                role="switch"
                aria-checked="true"
                disabled
                aria-label="Cookies nécessaires, toujours actifs"
              />
            </div>

            {OPTIONAL_CATEGORIES.map(({ key, title, desc }) => (
              <div className="ap-cookie-modal__row" key={key}>
                <div className="ap-cookie-modal__row-text">
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
                <button
                  type="button"
                  className={`ap-switch${draft[key] ? " is-on" : ""}`}
                  role="switch"
                  aria-checked={draft[key]}
                  aria-label={title}
                  onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                />
              </div>
            ))}

            <div className="ap-cookie-modal__actions">
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={rejectAll}>
                Tout refuser
              </button>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={acceptAll}>
                Tout accepter
              </button>
              <button type="button" className="ap-btn ap-btn--sm" onClick={() => savePreferences(draft)}>
                Enregistrer mes choix
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
