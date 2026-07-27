import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Bell, Check, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { useSEO } from "@/hooks/useSEO";
import { fetchChangelog, getChangelogSubscription, setChangelogSubscription } from "@/lib/pages/publicRepo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import type { ChangelogKind, Release } from "@/lib/pages/types";

const FILTERS: { key: "all" | ChangelogKind; label: string; icon: typeof Sparkles }[] = [
  { key: "all", label: "Tout", icon: Sparkles },
  { key: "new", label: "Nouveau", icon: Sparkles },
  { key: "imp", label: "Amélioré", icon: ArrowUp },
  { key: "fix", label: "Corrigé", icon: Wrench },
];

export default function Changelog() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<"all" | ChangelogKind>("all");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  useSEO({ title: "Nouveautés produit", description: "Toutes les nouveautés et corrections de Brivia.", path: "/changelog" });

  useEffect(() => {
    Promise.all([fetchChangelog(), getChangelogSubscription()])
      .then(([items, subscription]) => { setReleases(items); setSubscribed(subscription); })
      .catch(() => toast.error("Impossible de charger le changelog"))
      .finally(() => setLoading(false));
  }, []);
  const visible = useMemo(() => releases.filter((release) => filter === "all" || release.items.some((item) => item.t === filter)), [filter, releases]);

  const toggleSubscription = async () => {
    try {
      await setChangelogSubscription(subscribed);
      setSubscribed((value) => !value);
      toast.success(subscribed ? "Abonnement désactivé" : "Vous recevrez les prochaines nouveautés");
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") window.location.href = "/auth";
      else toast.error("Impossible de modifier l’abonnement");
    }
  };

  return (
    <AppLayout subtitle="Changelog">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div><h1 className="ap-h2" style={{ fontSize: 26, marginBottom: 4 }}>Nouveautés produit</h1><p className="ap-muted" style={{ fontSize: 14 }}>Les nouveautés, améliorations et corrections de Brivia.</p></div>
          <button className={subscribed ? "ap-btn ap-btn--ghost ap-btn--sm" : "ap-btn ap-btn--sm"} onClick={() => void toggleSubscription()}>
            {subscribed ? <Check size={15} /> : <Bell size={15} />}{subscribed ? "Abonné" : "Recevoir les nouveautés"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {FILTERS.map(({ key, label, icon: Icon }) => <button key={key} className={filter === key ? "ap-btn ap-btn--sm" : "ap-btn ap-btn--ghost ap-btn--sm"} onClick={() => setFilter(key)}><Icon size={14} />{label}</button>)}
        </div>
        {!loading && visible.length === 0 ? (
          <ExplorerEmptyState icon={<Sparkles size={27} />} title="Aucune nouveauté" body="Les prochaines versions apparaîtront ici." />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {visible.map((release) => (
              <article key={release.v} className="ap-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <span className="ap-badge ap-badge--brand">{release.v}</span>
                  <h2 className="ap-h3" style={{ fontSize: 18 }}>{release.title}</h2>
                  <span className="ap-muted" style={{ marginLeft: "auto", fontSize: 12 }}>{release.date}</span>
                </div>
                {release.intro && <div className="ap-muted" style={{ fontSize: 13.5, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(release.intro) }} />}
                <div style={{ display: "grid", gap: 8 }}>
                  {release.items.filter((item) => filter === "all" || item.t === filter).map((item, index) => {
                    const meta = FILTERS.find((entry) => entry.key === item.t)!;
                    const Icon = meta.icon;
                    return <div key={`${item.text}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, paddingTop: 8, borderTop: "var(--ap-border-w) solid var(--ap-line)" }}><Icon size={15} style={{ marginTop: 2, color: "var(--ap-brand)", flexShrink: 0 }} /><span style={{ fontSize: 13.5 }}>{item.text}</span>{item.fromVotes && <span className="ap-pill" style={{ marginLeft: "auto", fontSize: 10 }}>issu des votes</span>}</div>;
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
