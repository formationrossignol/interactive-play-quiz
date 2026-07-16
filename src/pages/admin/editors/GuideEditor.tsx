import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import type { GuideAdminRow } from "@/lib/pages/types";

const COVER_TOKENS = ["--ap-quiz-soft", "--ap-brand-soft", "--ap-pres-soft", "--ap-poll-soft", "--ap-flash-soft"];
const LEVELS = ["deb", "int", "avc"] as const;
const FORMATS = ["video", "article"] as const;

type Values = Omit<GuideAdminRow, "id">;

export function GuideEditor({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: GuideAdminRow; onSave: (v: Values) => void;
}) {
  const [v, setV] = useState<Values>(() => ({
    emoji: initial?.emoji ?? "", cover_token: initial?.cover_token ?? COVER_TOKENS[0],
    duration_label: initial?.duration_label ?? "", title: initial?.title ?? "",
    level: initial?.level ?? "deb", format: initial?.format ?? "article",
    url: initial?.url ?? null, body: initial?.body ?? "",
    status: initial?.status ?? "draft", sort: initial?.sort ?? 0,
  }));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Éditer" : "Nouveau"} guide</DialogTitle></DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input placeholder="Emoji" value={v.emoji} onChange={(e) => set("emoji", e.target.value)} />
          <Select value={v.cover_token} onValueChange={(x) => set("cover_token", x)}>
            <SelectTrigger><SelectValue placeholder="Couverture" /></SelectTrigger>
            <SelectContent>{COVER_TOKENS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Durée (ex. 5 min)" value={v.duration_label} onChange={(e) => set("duration_label", e.target.value)} />
          <Input placeholder="Titre" value={v.title} onChange={(e) => set("title", e.target.value)} />
          <Select value={v.level} onValueChange={(x) => set("level", x as Values["level"])}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={v.format} onValueChange={(x) => set("format", x as Values["format"])}>
            <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="URL (optionnel)" value={v.url ?? ""} onChange={(e) => set("url", e.target.value || null)} />
          <RichTextEditor value={v.body ?? ""} onChange={(html) => set("body", html)} />
        </div>
        <DialogFooter>
          <Button disabled={!v.title.trim()} onClick={() => onSave(v)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
