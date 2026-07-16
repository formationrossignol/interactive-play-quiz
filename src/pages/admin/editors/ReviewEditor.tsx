import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ReviewAdminRow, ReviewPersona } from "@/lib/pages/types";

const PERSONAS: ReviewPersona[] = ["formateur", "enseignant", "entreprise"];
type Values = Omit<ReviewAdminRow, "id">;

export function ReviewEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: ReviewAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    persona: initial?.persona ?? "formateur", stars: initial?.stars ?? 5,
    text: initial?.text ?? "", author_name: initial?.author_name ?? "",
    author_role: initial?.author_role ?? "", avatar_emoji: initial?.avatar_emoji ?? "🙂",
    status: initial?.status ?? "published", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouveau"} témoignage</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set("stars", n)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: n <= v.stars ? "var(--ap-brand)" : "var(--ap-line-2)" }}
                aria-label={`${n} étoiles`}>★</button>
            ))}
          </div>
          <Textarea placeholder="Témoignage" value={v.text} onChange={(e) => set("text", e.target.value)} rows={4} />
          <div style={{ display: "flex", gap: 10 }}>
            <Input placeholder="Emoji" value={v.avatar_emoji} onChange={(e) => set("avatar_emoji", e.target.value)} style={{ width: 90 }} />
            <Input placeholder="Nom" value={v.author_name} onChange={(e) => set("author_name", e.target.value)} />
          </div>
          <Input placeholder="Rôle (ex. Formatrice indépendante)" value={v.author_role} onChange={(e) => set("author_role", e.target.value)} />
          <Select value={v.persona} onValueChange={(x) => set("persona", x as ReviewPersona)}>
            <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
            <SelectContent>{PERSONAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={!v.text.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
