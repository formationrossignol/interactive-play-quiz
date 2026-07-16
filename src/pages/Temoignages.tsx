import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useReviews } from "@/lib/pages/hooks";
import type { Review } from "@/lib/pages/types";
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

const stars = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);

const Temoignages = () => {
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona>("all");
  const { data: reviews, isLoading } = useReviews();
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
            {isLoading ? (
              <div style={{ opacity: 0.5 }}>Chargement…</div>
            ) : (
              (reviews ?? [])
                .filter((r: Review) => persona === "all" || r.p === persona)
                .map((r) => (
                  <div className="card tcard" key={r.id}>
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
                ))
            )}
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
