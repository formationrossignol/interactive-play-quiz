import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FaqAdminRow } from "@/lib/pages/types";
import RichTextEditor from "@/components/RichTextEditor";

type Values = Omit<FaqAdminRow, "id">;

export function FaqEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: Partial<FaqAdminRow>; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    category: initial?.category ?? "", question: initial?.question ?? "",
    answer: initial?.answer ?? "", status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-48px)] max-w-5xl" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouvelle"} question</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input placeholder="Catégorie" value={v.category} onChange={(e) => set("category", e.target.value)} />
          <Input placeholder="Question" value={v.question} onChange={(e) => set("question", e.target.value)} />
          <RichTextEditor value={v.answer} onChange={(html) => set("answer", html)} placeholder="Rédigez la réponse…" />
        </div>
        <DialogFooter>
          <Button disabled={!v.question.trim() || !v.answer.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
