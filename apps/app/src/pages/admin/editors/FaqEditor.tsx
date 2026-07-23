import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { FaqAdminRow } from "@/lib/pages/types";

type Values = Omit<FaqAdminRow, "id">;

export function FaqEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: FaqAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    category: initial?.category ?? "", question: initial?.question ?? "",
    answer: initial?.answer ?? "", status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouvelle"} question</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input placeholder="Catégorie" value={v.category} onChange={(e) => set("category", e.target.value)} />
          <Input placeholder="Question" value={v.question} onChange={(e) => set("question", e.target.value)} />
          <Textarea placeholder="Réponse" value={v.answer} onChange={(e) => set("answer", e.target.value)} />
        </div>
        <DialogFooter>
          <Button disabled={!v.question.trim() || !v.answer.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
