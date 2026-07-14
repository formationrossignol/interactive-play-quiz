import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import "./community-pages.css";

type Persona = "all" | "formateur" | "enseignant" | "entreprise";

const BARS = [
  { label: "5 ★", pct: 82 },
  { label: "4 ★", pct: 13 },
  { label: "3 ★", pct: 4 },
  { label: "2 ★", pct: 1 },
  { label: "1 ★", pct: 0 },
];

const CHIPS: { p: Persona; label: string }[] = [
  { p: "all", label: "Tous" },
  { p: "formateur", label: "Formateurs indépendants" },
  { p: "enseignant", label: "Enseignants" },
  { p: "entreprise", label: "Entreprises & écoles" },
];

const REVIEWS = [
  { p: "formateur", stars: 5, text: "Le lobby projeté fait son effet à chaque fois : les stagiaires dégainent leur téléphone avant même que j'aie fini d'expliquer. Zéro friction, zéro installation.", av: "🧔", name: "Karim T.", role: "Formateur DevOps indépendant" },
  { p: "entreprise", stars: 5, text: "On a remplacé notre ancien outil pour la conformité RGPD : hébergement UE, DPA signé en 48 h. Le service juridique a validé sans aller-retour — une première.", av: "🏢", name: "Claire D.", role: "Responsable formation, ETI industrielle" },
  { p: "enseignant", stars: 5, text: "Mes M2 réclament le quiz de fin de module. Le mode examen avec alertes de sortie d'onglet m'a évité deux litiges ce semestre : tout est tracé, horodaté, incontestable.", av: "👨‍🏫", name: "Julien P.", role: "Enseignant vacataire, M2 cloud" },
  { p: "formateur", stars: 4, text: "La génération IA depuis mes PDF me fait gagner une heure par module. Je retouche 20 % des questions, le reste est directement exploitable. Il manque juste les questions avec images.", av: "👩‍💻", name: "Nadia B.", role: "Formatrice Kubernetes" },
  { p: "enseignant", stars: 5, text: "Testé avec 160 étudiants en amphi : aucune latence, le podium final a déclenché une ovation. Je ne pensais pas dire ça d'un cours de réseaux à 8 h.", av: "👩‍🏫", name: "Sarah M.", role: "Enseignante-chercheuse" },
  { p: "entreprise", stars: 5, text: "Déployé pour 6 formateurs internes. La banque de questions partagée évite que chacun réinvente les mêmes QCM — on capitalise enfin sur nos contenus.", av: "🏫", name: "Marc L.", role: "Directeur pédagogique, CFA" },
] as const;

const stars = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);

const Temoignages = () => {
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona>("all");
  useSEO({
    title: "Témoignages",
    description: "Avis vérifiés de formateurs, enseignants et responsables formation qui animent avec Ludiq. Note moyenne 4,8/5 sur 312 avis.",
    path: "/reviews",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Témoignages</span>
            <h1>Ils animent avec Ludiq.</h1>
            <p className="lead">Avis vérifiés de formateurs, enseignants et responsables formation.</p>
          </div>

          <div className="card ratingband">
            <div className="bigscore">
              <b>4,8</b>
              <div className="stars">★★★★★</div>
              <small>312 avis vérifiés</small>
            </div>
            <div className="rbars">
              {BARS.map((b) => (
                <div className="rbar" key={b.label}>
                  <span className="rl">{b.label}</span>
                  <div className="rtrack"><i style={{ width: `${b.pct}%` }} /></div>
                  <span className="rp">{b.pct} %</span>
                </div>
              ))}
            </div>
          </div>

          <div className="featured-t">
            <div className="fpic">👩‍🏫</div>
            <div>
              <blockquote>
                « Avant, je terminais mes modules sans savoir ce qui était acquis. Maintenant, les analytics me disent quoi réexpliquer avant l'examen. Mon taux de réussite a gagné 12 points en un semestre. »
              </blockquote>
              <footer>Responsable pédagogique — école d'ingénieurs, Toulouse · cliente depuis 14 mois</footer>
            </div>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <button
                key={c.p}
                className={`chip${persona === c.p ? " on" : ""}`}
                onClick={() => setPersona(c.p)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="tgrid">
            {REVIEWS.filter((r) => persona === "all" || r.p === persona).map((r, i) => (
              <div className="card tcard" key={i}>
                <div className="tstars">{stars(r.stars)}</div>
                <p>{r.text}</p>
                <div className="twho">
                  <span className="tw-av">{r.av}</span>
                  <div>
                    <b>{r.name}</b>
                    <small>{r.role}</small>
                  </div>
                  <span className="pill tsrc">✓ Vérifié</span>
                </div>
              </div>
            ))}
          </div>

          <div className="finalcta">
            <h2>Rejoignez-les.</h2>
            <p>Gratuit pour commencer, 5 minutes pour votre premier quiz.</p>
            <button
              className="btn btn--quiz"
              style={{ fontSize: "16px", padding: "14px 30px" }}
              onClick={() => navigate("/builder-start?type=quiz")}
            >
              Créer mon premier quiz
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Temoignages;
