"use client";

import { useState, useEffect } from "react";
import { isSubscribed, subscribe, unsubscribe, requireAuth } from "@/lib/interactionsRepo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import type { Release } from "@/lib/types";

type Kind = "all" | "new" | "imp" | "fix";

const CHIPS: { key: Kind; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "new", label: "✦ Nouveau" },
  { key: "imp", label: "↑ Amélioré" },
  { key: "fix", label: "🔧 Corrigé" },
];

const KIND_LABEL: Record<string, { cls: string; label: string }> = {
  new: { cls: "reltag--new", label: "Nouveau" },
  imp: { cls: "reltag--imp", label: "Amélioré" },
  fix: { cls: "reltag--fix", label: "Corrigé" },
};

export function ChangelogView({ releases }: { releases: Release[] }) {
  const [filter, setFilter] = useState<Kind>("all");
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [subPending, setSubPending] = useState(false);

  useEffect(() => {
    isSubscribed().then((s) => { setSubscribed(s); setSubLoading(false); });
  }, []);

  const toggleSubscribe = async () => {
    if (!(await requireAuth())) return;
    setSubPending(true);
    try {
      if (subscribed) await unsubscribe(); else await subscribe();
      setSubscribed((s) => !s);
    } finally {
      setSubPending(false);
    }
  };

  const releaseVisible = (r: Release) => filter === "all" || r.items.some((it) => it.t === filter);

  return (
    <>
      <div className="subscribe">
        <button className="btn btn--sm" disabled={subLoading || subPending} onClick={toggleSubscribe}>
          {subscribed ? "Abonné ✓ — se désabonner" : "Recevoir les nouveautés"}
        </button>
      </div>

      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c.key} className={`chip${filter === c.key ? " on" : ""}`} onClick={() => setFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="changelog">
        {releases.filter(releaseVisible).map((r) => (
          <div className="release" key={r.v}>
            <div className="card rel-card">
              <div className="rel-head">
                <span className="vtag">{r.v}</span>
                <h3>{r.title}</h3>
                <span className="rel-date">{r.date}</span>
              </div>
              {r.intro && <div className="rel-intro" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.intro) }} />}
              {r.media && <div className="rel-media">{r.media}</div>}
              {r.items
                .filter((it) => filter === "all" || it.t === filter)
                .map((it, i) => (
                  <div className="rel-item" key={i}>
                    <span className={`reltag ${KIND_LABEL[it.t].cls}`}>{KIND_LABEL[it.t].label}</span>
                    <span>
                      {it.text}
                      {it.fromVotes && <span className="fromvotes">▲ issue de vos votes</span>}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
