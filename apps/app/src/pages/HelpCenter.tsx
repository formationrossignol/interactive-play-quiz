import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  LifeBuoy,
  MessageCircle,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { useSEO } from "@/hooks/useSEO";
import { marketingUrl } from "@/lib/marketingOrigin";
import { fetchFaq } from "@/lib/pages/publicRepo";
import type { FaqGroup } from "@/lib/pages/types";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export default function HelpCenter() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<FaqGroup[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  useSEO({ title: "Centre d’aide", description: "Guides et réponses pour utiliser Brivia.", path: "/help" });

  useEffect(() => {
    fetchFaq()
      .then(setGroups)
      .catch(() => toast.error("Le centre d’aide n’a pas pu être chargé"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return groups
      .filter((group) => category === "Toutes" || group.category === category)
      .map((group) => ({
        ...group,
        questions: group.questions.filter((question) => (
          !normalizedQuery
          || question.q.toLocaleLowerCase("fr").includes(normalizedQuery)
          || question.a.replace(/<[^>]+>/g, " ").toLocaleLowerCase("fr").includes(normalizedQuery)
        )),
      }))
      .filter((group) => group.questions.length > 0);
  }, [category, groups, query]);

  const toggle = (key: string) => setOpenQuestions((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <AppLayout subtitle="Centre d’aide">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <section style={{ marginBottom: 28 }}>
          <span style={{ width: 42, height: 42, display: "grid", placeItems: "center", marginBottom: 14, borderRadius: "var(--ap-r-md)", background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}>
            <CircleHelp size={21} />
          </span>
          <h1 className="ap-h2" style={{ fontSize: 28, marginBottom: 5 }}>Comment pouvons-nous vous aider ?</h1>
          <p className="ap-muted" style={{ fontSize: 14 }}>Recherchez une réponse ou contactez directement l’équipe depuis l’application.</p>
        </section>

        <div style={{ position: "relative", marginBottom: 15 }}>
          <Search size={18} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--ap-muted)" }} />
          <input
            className="ap-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans le centre d’aide…"
            aria-label="Rechercher dans le centre d’aide"
            style={{ width: "100%", minHeight: 48, paddingLeft: 44, fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 22 }}>
          {["Toutes", ...groups.map((group) => group.category)].map((item) => (
            <button key={item} className={category === item ? "ap-btn ap-btn--sm" : "ap-btn ap-btn--ghost ap-btn--sm"} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ap-muted" style={{ padding: 40, textAlign: "center" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <ExplorerEmptyState
            icon={<Search size={27} />}
            title="Aucune réponse trouvée"
            body="Essayez une autre recherche ou envoyez votre question à l’équipe."
            action={<button className="ap-btn ap-btn--sm" onClick={() => navigate("/report")}><LifeBuoy size={15} /> Contacter le support</button>}
          />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filtered.map((group) => (
              <section key={group.category} className="ap-card" style={{ padding: "6px 20px 4px" }}>
                <h2 style={{ padding: "14px 0 8px", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ap-brand)" }}>
                  {group.category}
                </h2>
                {group.questions.map((question) => {
                  const key = `${group.category}:${question.q}`;
                  const open = openQuestions.has(key);
                  return (
                    <div key={key} style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 0", border: 0, background: "transparent", color: "var(--ap-ink)", textAlign: "left", cursor: "pointer" }}
                      >
                        <strong style={{ flex: 1, fontSize: 14.5 }}>{question.q}</strong>
                        <ChevronDown size={17} style={{ color: "var(--ap-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .16s" }} />
                      </button>
                      {open && (
                        <div
                          className="ap-muted"
                          style={{ padding: "0 0 17px", fontSize: 13.5, lineHeight: 1.65 }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.a) }}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 22 }}>
          <a className="ap-card ap-card--hover" href={marketingUrl("/guides")} style={{ padding: 18, color: "inherit", textDecoration: "none" }}>
            <BookOpen size={19} style={{ color: "var(--ap-brand)", marginBottom: 10 }} />
            <strong style={{ display: "block", marginBottom: 4 }}>Consulter les guides</strong>
            <span className="ap-muted" style={{ fontSize: 12.5 }}>Tutoriels et prises en main détaillées.</span>
          </a>
          <button className="ap-card ap-card--hover" onClick={() => navigate("/community")} style={{ padding: 18, color: "inherit", textAlign: "left", cursor: "pointer" }}>
            <MessageCircle size={19} style={{ color: "var(--ap-poll)", marginBottom: 10 }} />
            <strong style={{ display: "block", marginBottom: 4 }}>Demander à la communauté</strong>
            <span className="ap-muted" style={{ fontSize: 12.5 }}>Échangez avec les autres utilisateurs.</span>
          </button>
          <button className="ap-card ap-card--hover" onClick={() => navigate("/report")} style={{ padding: 18, color: "inherit", textAlign: "left", cursor: "pointer" }}>
            <LifeBuoy size={19} style={{ color: "var(--ap-quiz)", marginBottom: 10 }} />
            <strong style={{ display: "block", marginBottom: 4 }}>Contacter le support</strong>
            <span className="ap-muted" style={{ fontSize: 12.5 }}>Créez et suivez une demande d’assistance.</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
