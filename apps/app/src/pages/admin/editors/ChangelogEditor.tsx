import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import { useReleaseItems } from "@/lib/pages/adminHooks";
import type { ReleaseAdminRow } from "@/lib/pages/types";

type Values = Omit<ReleaseAdminRow, "id">;

// NOTE (simplification, per plan): full CRUD for individual changelog items
// (add/edit/remove kind/text/from_votes) is not wired here. That would require
// threading item-level create/update/delete mutations through this dialog's
// props, which adds real complexity for an MVP admin screen. Instead, when
// editing an existing release, its items are fetched read-only via
// `useReleaseItems` and simply listed below the release fields. Item editing
// remains a known gap — flagged for a follow-up rather than blocking this task.
export function ChangelogEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: ReleaseAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    version: initial?.version ?? "", title: initial?.title ?? "",
    date_label: initial?.date_label ?? "", media: initial?.media ?? null,
    intro: initial?.intro ?? "", status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  const items = useReleaseItems(initial?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouvelle"} release</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input placeholder="Version (ex. v1.4.0)" value={v.version} onChange={(e) => set("version", e.target.value)} />
          <Input placeholder="Titre" value={v.title} onChange={(e) => set("title", e.target.value)} />
          <Input placeholder="Date (ex. 12 juillet 2026)" value={v.date_label} onChange={(e) => set("date_label", e.target.value)} />
          <Input placeholder="Média (URL, optionnel)" value={v.media ?? ""} onChange={(e) => set("media", e.target.value || null)} />
          <RichTextEditor value={v.intro ?? ""} onChange={(html) => set("intro", html)} placeholder="Introduction de la release..." />

          {initial && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Items (lecture seule)</span>
              {(items.data ?? []).map((it) => (
                <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge variant="secondary">{it.kind}</Badge>
                  <span style={{ fontSize: 13 }}>{it.text}</span>
                  {it.from_votes && <Badge variant="outline">roadmap</Badge>}
                </div>
              ))}
              {items.data?.length === 0 && <span style={{ fontSize: 12, opacity: 0.6 }}>Aucun item.</span>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!v.version.trim() || !v.title.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
