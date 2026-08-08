import { useEffect, useState } from "react";
import { fetchLatestChangelog, type ChangelogRelease } from "@/lib/changelog";
import { ListSkeleton } from "@/components/ui/skeletons";
import { Link } from "react-router-dom";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export function NewsModule() {
  const [releases, setReleases] = useState<ChangelogRelease[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestChangelog(5).then((r) => { if (!cancelled) setReleases(r); });
    return () => { cancelled = true; };
  }, []);

  return (
    <aside className="product-panel" aria-labelledby="dashboard-news-title">
      <div className="product-section-heading">
        <div>
          <h2 id="dashboard-news-title">Nouveautés</h2>
          <p>Les dernières évolutions de Brivia.</p>
        </div>
      </div>
      {releases === null ? (
        <ListSkeleton rows={3} avatarClassName="rounded-lg" />
      ) : releases.length === 0 ? (
        <div className="product-empty-inline" style={{ minHeight: 180 }}>
          <div>
            <MaterialSymbol name="rocket_launch" size={24} />
            <strong>Vous êtes à jour</strong>
            <span style={{ fontSize: 12 }}>Les prochaines versions seront publiées ici.</span>
          </div>
        </div>
      ) : (
        <div className="product-news-list">
          {releases.map((r) => (
            <div key={r.id} className="product-news-item">
              <span className="product-news-item__icon">
                <MaterialSymbol name="rocket_launch" size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 720, fontSize: "12.5px", color: "var(--ap-ink)" }}>
                  {r.title} <span className="ap-muted" style={{ fontWeight: 600 }}>{r.version}</span>
                </div>
                <div className="ap-muted" style={{ fontSize: "10.5px", marginTop: 2 }}>{r.dateLabel}</div>
                {r.intro && <p style={{ fontSize: "11.5px", color: "var(--ap-muted)", marginTop: "4px", lineHeight: 1.45 }}>{r.intro}</p>}
              </div>
            </div>
          ))}
          <Link to="/changelog" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
            Voir tout le changelog
          </Link>
        </div>
      )}
    </aside>
  );
}
