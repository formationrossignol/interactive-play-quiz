"use client";

import { useState } from "react";
import { submitReview, requireAuth } from "@/lib/interactionsRepo";
import type { Review, ReviewPersona } from "@/lib/types";

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

export function ReviewsView({ reviews }: { reviews: Review[] }) {
  const [persona, setPersona] = useState<Persona>("all");
  const [rvPersona, setRvPersona] = useState<ReviewPersona>("formateur");
  const [rvStars, setRvStars] = useState(5);
  const [rvText, setRvText] = useState("");
  const [rvRole, setRvRole] = useState("");
  const [rvSent, setRvSent] = useState(false);
  const [rvPending, setRvPending] = useState(false);

  const onSubmitReview = async () => {
    if (!rvText.trim() || rvPending) return;
    if (!(await requireAuth())) return;
    setRvPending(true);
    try {
      await submitReview({ persona: rvPersona, stars: rvStars, text: rvText.trim(), authorRole: rvRole.trim() });
      setRvSent(true);
    } finally {
      setRvPending(false);
    }
  };

  return (
    <>
      <div className="page-hero">
        <span className="eyebrow">Témoignages</span>
        <h1>Ils animent avec Brivia.</h1>
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
            « Avant, je terminais mes modules sans savoir ce qui était acquis. Maintenant, les analytics me disent quoi réexpliquer avant l&apos;examen. Mon taux de réussite a gagné 12 points en un semestre. »
          </blockquote>
          <footer>Responsable pédagogique — école d&apos;ingénieurs, Toulouse · cliente depuis 14 mois</footer>
        </div>
      </div>

      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c.p} className={`chip${persona === c.p ? " on" : ""}`} onClick={() => setPersona(c.p)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="tgrid">
        {reviews
          .filter((r) => persona === "all" || r.p === persona)
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
          ))}
      </div>

      <div className="card" style={{ padding: "24px 28px", marginBottom: "28px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ fontSize: "16px" }}>Partagez votre expérience</h3>
        {rvSent ? (
          <p style={{ color: "var(--ap-muted)", fontWeight: 700 }}>Merci ! Votre avis sera publié après modération.</p>
        ) : (
          <>
            <div className="chips">
              {CHIPS.filter((c) => c.p !== "all").map((c) => (
                <button key={c.p} className={`chip${rvPersona === c.p ? " on" : ""}`} onClick={() => setRvPersona(c.p as ReviewPersona)}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRvStars(n)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "22px", color: n <= rvStars ? "var(--ap-brand)" : "var(--ap-line-2)" }} aria-label={`${n} étoiles`}>★</button>
              ))}
            </div>
            <input value={rvRole} onChange={(e) => setRvRole(e.target.value)} placeholder="Votre rôle (ex. Formateur indépendant)" />
            <textarea rows={3} value={rvText} onChange={(e) => setRvText(e.target.value)} placeholder="Qu'est-ce qui vous a plu ?" />
            <button className="btn" style={{ alignSelf: "flex-start" }} disabled={rvPending || !rvText.trim()} onClick={onSubmitReview}>
              Envoyer mon avis
            </button>
          </>
        )}
      </div>

      <div className="finalcta">
        <h2>Rejoignez-les.</h2>
        <p>Gratuit pour commencer, 5 minutes pour votre premier quiz.</p>
        <a className="btn btn--quiz" style={{ fontSize: "16px", padding: "14px 30px" }} href="/builder-start?type=quiz">
          Créer mon premier quiz
        </a>
      </div>
    </>
  );
}
