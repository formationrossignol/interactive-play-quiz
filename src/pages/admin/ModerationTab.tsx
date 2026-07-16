import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useModerationReviews, useModerationIdeas, useModerationReports } from "@/lib/pages/adminHooks";
import type { ReportStatus } from "@/lib/pages/types";

const REPORT_STATUSES: ReportStatus[] = ["open", "in_progress", "waiting", "resolved"];

export const ModerationTab = () => {
  const reviews = useModerationReviews();
  const ideas = useModerationIdeas();
  const reports = useModerationReports();
  const [convert, setConvert] = useState<{ ideaId: string; text: string } | null>(null);
  const [col, setCol] = useState("idea");
  const [category, setCategory] = useState("builder");
  const [title, setTitle] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 16 }}>
      <section>
        <h3>Avis en attente</h3>
        {(reviews.list.data ?? []).map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div>{"★".repeat(r.stars)} — <b>{r.author_name}</b> <small>{r.author_role}</small></div>
            <p>{r.text}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "published" })}>Publier</Button>
              <Button size="sm" variant="outline" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "rejected" })}>Rejeter</Button>
            </div>
          </div>
        ))}
        {(reviews.list.data ?? []).length === 0 && <p style={{ opacity: 0.6 }}>Aucun avis en attente.</p>}
      </section>

      <section>
        <h3>Idées en attente</h3>
        {(ideas.list.data ?? []).map((i) => (
          <div key={i.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <p>{i.text}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={() => { setConvert({ ideaId: i.id, text: i.text }); setTitle(i.text.slice(0, 60)); }}>Convertir</Button>
              <Button size="sm" variant="outline" onClick={() => ideas.setStatus.mutate({ id: i.id, status: "rejected" })}>Rejeter</Button>
            </div>
          </div>
        ))}
        {(ideas.list.data ?? []).length === 0 && <p style={{ opacity: 0.6 }}>Aucune idée en attente.</p>}
      </section>

      <section>
        <h3>Tickets</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Titre</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {(reports.list.data ?? []).map((rep) => (
              <TableRow key={rep.id}>
                <TableCell>{rep.title}</TableCell>
                <TableCell>{rep.type}</TableCell>
                <TableCell>
                  <Select value={rep.status} onValueChange={(x) => reports.setStatus.mutate({ id: rep.id, status: x as ReportStatus })}>
                    <SelectTrigger style={{ width: 170 }}><SelectValue /></SelectTrigger>
                    <SelectContent>{REPORT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convertir en carte roadmap</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={col} onValueChange={setCol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["idea", "planned", "dev"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["builder", "live", "exams", "analytics", "integrations", "orga", "a11y"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={!title.trim()} onClick={() => {
              if (!convert) return;
              ideas.convert.mutate({ ideaId: convert.ideaId, input: { col, category, title: title.trim(), subtitle: "" } });
              setConvert(null);
            }}>Créer la carte (brouillon)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
