import { useState } from "react";
import { useAdminStaticPages } from "@/lib/pages/adminHooks";
import { STATIC_PAGE_META, STATIC_PAGE_DEFAULTS, mergeStaticPage, type StaticSlug } from "@/lib/pages/staticPageDefaults";
import type { StaticPage } from "@/lib/pages/types";
import { StaticPageEditor } from "./editors/StaticPageEditor";

export const StaticPagesList = () => {
  const { list, save } = useAdminStaticPages();
  const [editing, setEditing] = useState<{ slug: StaticSlug; page: StaticPage } | null>(null);

  const rowBySlug = (slug: string) => (list.data ?? []).find((p) => p.slug === slug);
  const effective = (slug: StaticSlug) => mergeStaticPage(STATIC_PAGE_DEFAULTS[slug], rowBySlug(slug));
  const meta = (slug: StaticSlug) => STATIC_PAGE_META.find((m) => m.slug === slug)!;

  return (
    <>
      <div className="adm-rows">
        {STATIC_PAGE_META.map((m) => {
          const page = effective(m.slug);
          return (
            <div className="adm-row" key={m.slug}>
              <span className="r-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="adm-tav" style={{ width: 32, height: 32, fontSize: 16 }}>{m.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block" }}>{m.label}</b>
                  <small style={{ color: "var(--ap-muted)", fontWeight: 700 }}>{m.path}</small>
                </span>
              </span>
              <span className="adm-status is-published">publié</span>
              <div className="r-actions">
                <a className="adm-btn adm-btn--ghost adm-btn--sm" href={m.path} target="_blank" rel="noopener noreferrer">Voir ↗</a>
                <button className="adm-btn adm-btn--sm" onClick={() => setEditing({ slug: m.slug, page })}>Éditer</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <StaticPageEditor
          open
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing.page}
          hasBlocks={meta(editing.slug).hasBlocks}
          onSave={(v) => { save.mutate({ ...v, slug: editing.slug }); setEditing(null); }}
        />
      )}
    </>
  );
};
