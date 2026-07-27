import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { fetchLatestChangelog, type ChangelogRelease } from "@/lib/changelog";
import { ListSkeleton } from "@/components/ui/skeletons";
import { Link } from "react-router-dom";

export function NewsModule() {
  const [releases, setReleases] = useState<ChangelogRelease[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestChangelog(5).then((r) => { if (!cancelled) setReleases(r); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="ap-card" style={{ padding: "20px" }}>
      <h2 className="ap-h3" style={{ fontSize: "16px", marginBottom: "16px" }}>Nouveautés</h2>
      {releases === null ? (
        <ListSkeleton rows={3} avatarClassName="rounded-lg" />
      ) : releases.length === 0 ? (
        <p className="ap-muted" style={{ fontSize: "13px" }}>Pas de nouveautés pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {releases.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 32, height: 32, flexShrink: 0 }}>
                <Rocket style={{ width: 16, height: 16, color: "var(--ap-brand)" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ap-ink)" }}>
                  {r.title} <span className="ap-muted" style={{ fontWeight: 600 }}>· {r.version}</span>
                </div>
                <div className="ap-muted" style={{ fontSize: "12px" }}>{r.dateLabel}</div>
                {r.intro && <p style={{ fontSize: "12px", color: "var(--ap-muted)", marginTop: "4px" }}>{r.intro}</p>}
              </div>
            </div>
          ))}
          <Link to="/changelog" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
            Voir tout le changelog
          </Link>
        </div>
      )}
    </div>
  );
}
