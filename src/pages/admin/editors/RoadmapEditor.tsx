import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { RoadmapAdminRow } from "@/lib/pages/types";

const COLS = ["idea", "planned", "dev", "shipped"];
const CATS = ["builder", "live", "exams", "analytics", "integrations", "orga", "a11y"];

type Values = Omit<RoadmapAdminRow, "id">;

export function RoadmapEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: RoadmapAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    col: initial?.col ?? "idea", category: initial?.category ?? "builder",
    title: initial?.title ?? "", subtitle: initial?.subtitle ?? "",
    tags: initial?.tags ?? [], beta: initial?.beta ?? false, locked: initial?.locked ?? false,
    base_votes: initial?.base_votes ?? 0, shipped_label: initial?.shipped_label ?? null,
    shipped_link: initial?.shipped_link ?? false, status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouvelle"} carte roadmap</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Select value={v.col} onValueChange={(x) => set("col", x as Values["col"])}>
            <SelectTrigger><SelectValue placeholder="Colonne" /></SelectTrigger>
            <SelectContent>{COLS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={v.category} onValueChange={(x) => set("category", x)}>
            <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Titre" value={v.title} onChange={(e) => set("title", e.target.value)} />
          <Textarea placeholder="Sous-titre" value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          <Input type="number" placeholder="Votes de base" value={v.base_votes} onChange={(e) => set("base_votes", Number(e.target.value))} />
          <Input placeholder="Libellé livré (optionnel)" value={v.shipped_label ?? ""} onChange={(e) => set("shipped_label", e.target.value || null)} />
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.beta} onCheckedChange={(x) => set("beta", x)} /> Bêta</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.locked} onCheckedChange={(x) => set("locked", x)} /> Vote verrouillé</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch checked={v.shipped_link} onCheckedChange={(x) => set("shipped_link", x)} /> Lien « nouveauté »</label>
        </div>
        <DialogFooter>
          <Button disabled={!v.title.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
