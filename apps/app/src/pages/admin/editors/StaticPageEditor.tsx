import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import type { StaticPage, StaticPageBlock } from "@/lib/pages/types";

export function StaticPageEditor({ open, onOpenChange, initial, hasBlocks, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial: StaticPage; hasBlocks: boolean; onSave: (v: StaticPage) => void;
}) {
  const [v, setV] = useState<StaticPage>(() => ({ ...initial, blocks: initial.blocks.map((b) => ({ ...b })) }));
  const set = <K extends keyof StaticPage>(k: K, val: StaticPage[K]) => setV((s) => ({ ...s, [k]: val }));

  const setBlock = (i: number, patch: Partial<StaticPageBlock>) =>
    setV((s) => ({ ...s, blocks: s.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const addBlock = () => setV((s) => ({ ...s, blocks: [...s.blocks, { title: "", desc: "" }] }));
  const removeBlock = (i: number) => setV((s) => ({ ...s, blocks: s.blocks.filter((_, j) => j !== i) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <DialogHeader><DialogTitle>Éditer — {initial.title}</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontWeight: 800, fontSize: 12 }}>Titre</label>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} />

          <label style={{ fontWeight: 800, fontSize: 12 }}>Sous-titre</label>
          <Textarea value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} rows={2} />

          <label style={{ fontWeight: 800, fontSize: 12 }}>{hasBlocks ? "Introduction" : "Contenu"}</label>
          <RichTextEditor value={v.body} onChange={(html) => set("body", html)} placeholder="Contenu de la page…" />

          {hasBlocks && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontWeight: 800, fontSize: 12 }}>Cartes</label>
              {v.blocks.map((b, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Input placeholder="Titre de la carte" value={b.title} onChange={(e) => setBlock(i, { title: e.target.value })} />
                    <button className="adm-iconbtn del" style={{ flex: "0 0 auto", padding: "8px 10px" }} onClick={() => removeBlock(i)}>🗑</button>
                  </div>
                  <Textarea placeholder="Description" value={b.desc} onChange={(e) => setBlock(i, { desc: e.target.value })} rows={2} />
                </div>
              ))}
              <button className="adm-bcol-add" onClick={addBlock}>+ Ajouter une carte</button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!v.title.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
