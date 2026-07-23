import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

  const reviewRows = reviews.list.data ?? [];
  const ideaRows = ideas.list.data ?? [];
  const reportRows = reports.list.data ?? [];

  return (
    <>
      <div className="adm-panel">
        <div className="adm-panel-head">
          <h3>⭐ Avis en attente <span className="adm-tag">{reviewRows.length}</span></h3>
        </div>
        {reviewRows.length === 0 ? (
          <div className="adm-empty"><span className="e-emo">✨</span>Aucun avis en attente.</div>
        ) : (
          <div className="adm-modgrid">
            {reviewRows.map((r) => (
              <div key={r.id} className="adm-modcard acc-flash">
                <div className="m-head">
                  <span className="m-stars">{"★".repeat(r.stars)}</span>
                  <span className="m-name">{r.author_name}</span>
                  <span className="m-role">{r.author_role}</span>
                </div>
                <p>{r.text}</p>
                <div className="m-actions">
                  <button className="adm-btn adm-btn--pres adm-btn--sm" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "published" })}>Publier</button>
                  <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => reviews.setStatus.mutate({ id: r.id, status: "rejected" })}>Rejeter</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="adm-panel">
        <div className="adm-panel-head">
          <h3>💡 Idées en attente <span className="adm-tag">{ideaRows.length}</span></h3>
        </div>
        {ideaRows.length === 0 ? (
          <div className="adm-empty"><span className="e-emo">💭</span>Aucune idée en attente.</div>
        ) : (
          <div className="adm-modgrid">
            {ideaRows.map((i) => (
              <div key={i.id} className="adm-modcard acc-poll">
                <p>{i.text}</p>
                <div className="m-actions">
                  <button className="adm-btn adm-btn--sm" onClick={() => { setConvert({ ideaId: i.id, text: i.text }); setTitle(i.text.slice(0, 60)); }}>Convertir</button>
                  <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => ideas.setStatus.mutate({ id: i.id, status: "rejected" })}>Rejeter</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="adm-panel">
        <div className="adm-panel-head">
          <h3>🎫 Tickets <span className="adm-tag">{reportRows.length}</span></h3>
        </div>
        {reportRows.length === 0 ? (
          <div className="adm-empty"><span className="e-emo">📭</span>Aucun ticket.</div>
        ) : (
          <div className="adm-rows">
            {reportRows.map((rep) => (
              <div key={rep.id} className="adm-row">
                <span className="r-title">{rep.title}</span>
                <span className="adm-status is-neutral">{rep.type}</span>
                <Select value={rep.status} onValueChange={(x) => reports.setStatus.mutate({ id: rep.id, status: x as ReportStatus })}>
                  <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <button className="adm-btn" disabled={!title.trim()} style={!title.trim() ? { opacity: 0.5, pointerEvents: "none" } : undefined} onClick={() => {
              if (!convert) return;
              ideas.convert.mutate({ ideaId: convert.ideaId, input: { col, category, title: title.trim(), subtitle: "" } });
              setConvert(null);
            }}>Créer la carte (brouillon)</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
