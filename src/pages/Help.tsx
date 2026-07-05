import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChevronDown, ChevronUp, HelpCircle, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";

const FAQ_ITEMS = [
  {
    category: "Démarrage",
    questions: [
      {
        q: "Comment créer mon premier quiz ?",
        a: "Cliquez sur « Créer gratuitement » depuis l'accueil, choisissez le type de contenu (Quiz, Sondage, Flashcard ou Présentation), puis construisez vos questions. Vous pouvez aussi partir d'un modèle prêt à l'emploi.",
      },
      {
        q: "Faut-il un compte pour utiliser l'application ?",
        a: "Vous pouvez créer et lancer du contenu sans compte, mais un compte permet de sauvegarder vos créations, d'accéder à vos statistiques et de retrouver vos résultats depuis n'importe quel appareil.",
      },
      {
        q: "L'application est-elle gratuite ?",
        a: "Oui, les fonctionnalités essentielles sont entièrement gratuites. Des options avancées (personnalisation avancée, export, analytics détaillées) sont disponibles dans les plans supérieurs.",
      },
    ],
  },
  {
    category: "Quiz & Sondages en direct",
    questions: [
      {
        q: "Comment les participants rejoignent-ils une session ?",
        a: "Partagez le code à 6 chiffres affiché à l'écran, ou le lien QR Code généré automatiquement. Les participants ouvrent l'application sur leur smartphone et saisissent le code — aucune inscription requise.",
      },
      {
        q: "Combien de participants peut-on accueillir simultanément ?",
        a: "Il n'y a pas de limite stricte côté application. En pratique, les sessions fonctionnent très bien jusqu'à plusieurs centaines de participants. La synchronisation repose sur Supabase Realtime.",
      },
      {
        q: "Les réponses des sondages sont-elles sauvegardées ?",
        a: "Oui. Dès que vous lancez un sondage, les réponses des participants sont collectées en temps réel et accessibles dans la page « Résultats » du sondage, avec des graphiques par question.",
      },
      {
        q: "Peut-on relancer un même quiz plusieurs fois ?",
        a: "Absolument. Depuis « Mes Quiz », cliquez sur « Lancer » — chaque lancement crée une nouvelle session avec un code unique. Les sessions précédentes restent dans l'historique.",
      },
    ],
  },
  {
    category: "Flashcards & Présentations",
    questions: [
      {
        q: "Comment fonctionne le mode Flashcard ?",
        a: "Les flashcards s'affichent une par une en mode révision : recto (question ou terme) puis verso (réponse ou définition). Idéal pour mémoriser du vocabulaire, des formules ou des concepts clés.",
      },
      {
        q: "Puis-je insérer des images dans mes slides ?",
        a: "Oui, chaque diapositive et chaque question peut inclure une image (URL ou upload). Les images sont affichées en pleine largeur dans le mode présentation.",
      },
    ],
  },
  {
    category: "Données & Confidentialité",
    questions: [
      {
        q: "Où sont stockées mes données ?",
        a: "Les contenus créés sont stockés localement dans votre navigateur (localStorage) et, lorsqu'un compte est actif, synchronisés via Supabase (hébergé en Europe). Aucune donnée n'est vendue à des tiers.",
      },
      {
        q: "Comment supprimer mes créations ?",
        a: "Dans les pages « Mes Quiz », « Mes Sondages » ou « Mes Flashcards », cliquez sur l'icône corbeille de la carte concernée, puis confirmez la suppression.",
      },
    ],
  },
];

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "2px solid var(--ap-line)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", background: "none", border: "none", cursor: "pointer",
          textAlign: "left", gap: "12px",
        }}
      >
        <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "15px", color: "var(--ap-ink)", flex: 1 }}>
          {q}
        </span>
        {open
          ? <ChevronUp style={{ width: 18, height: 18, color: "var(--ap-brand)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: 18, height: 18, color: "var(--ap-muted)", flexShrink: 0 }} />
        }
      </button>
      {open && (
        <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 600, fontSize: "14px", lineHeight: 1.6, color: "var(--ap-muted)", paddingBottom: "16px", margin: 0 }}>
          {a}
        </p>
      )}
    </div>
  );
};

const Help = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Centre d'aide",
    description: "FAQ et guides pour créer vos premiers quiz, lancer une session en direct, gérer vos participants et exporter vos résultats sur Ludiq.",
    path: "/help",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--ap-paper)" }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-3xl px-6 py-16">

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="ap-badge ap-badge--brand" style={{ marginBottom: "20px", display: "inline-flex" }}>
              Centre d'aide
            </span>
            <h1 className="ap-h1" style={{ fontSize: "clamp(32px,5vw,48px)", marginBottom: "16px" }}>
              Comment pouvons-nous vous aider ?
            </h1>
            <p className="ap-lead">
              Retrouvez les réponses aux questions les plus fréquentes ci-dessous.
            </p>
          </div>

          {/* FAQ sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "48px" }}>
            {FAQ_ITEMS.map((section) => (
              <div key={section.category} className="ap-card" style={{ padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--ap-brand)", marginBottom: "4px" }}>
                  {section.category}
                </h2>
                {section.questions.map((item) => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            ))}
          </div>

          {/* CTA — contact */}
          <div className="ap-card ap-card--floaty" style={{ padding: "36px", textAlign: "center" }}>
            <div className="ap-tile__icon" style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)", margin: "0 auto 16px" }}>
              <HelpCircle className="h-6 w-6" color="#fff" />
            </div>
            <h3 className="ap-h3" style={{ marginBottom: "8px" }}>Vous n'avez pas trouvé votre réponse ?</h3>
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "20px" }}>
              Notre équipe est là pour vous aider. Envoyez-nous un message.
            </p>
            <button
              className="ap-btn ap-btn--pill"
              onClick={() => navigate("/contact")}
              style={{ gap: "8px" }}
            >
              <Mail className="w-4 h-4" />
              Nous contacter
            </button>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Help;
