import { useEffect, useState } from "react";
import { Bug, CircleAlert, CircleHelp, CreditCard, Send, Ticket, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";
import { fetchMyReports, submitReport } from "@/lib/pages/publicRepo";
import type { MyReport, ReportSeverity, ReportType } from "@/lib/pages/types";

const TYPES: { key: ReportType; label: string; detail: string; icon: typeof Bug }[] = [
  { key: "bug", label: "Bug", detail: "Quelque chose est cassé", icon: Bug },
  { key: "question", label: "Question", detail: "Besoin d’aide", icon: CircleHelp },
  { key: "billing", label: "Facturation", detail: "Paiement ou facture", icon: CreditCard },
];
const SEVERITIES: { key: ReportSeverity; label: string; detail: string }[] = [
  { key: 1, label: "Bloquant", detail: "Session ou examen impossible" },
  { key: 2, label: "Gênant", detail: "Un contournement existe" },
  { key: 3, label: "Mineur", detail: "Cosmétique ou suggestion" },
];

export default function Report() {
  const [type, setType] = useState<ReportType>("bug");
  const [severity, setSeverity] = useState<ReportSeverity>(2);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [pending, setPending] = useState(false);
  useSEO({ title: "Signaler un problème", description: "Décrivez un problème et suivez sa résolution.", path: "/report" });

  const refresh = () => fetchMyReports().then(setReports).catch(() => toast.error("Impossible de charger vos tickets"));
  useEffect(() => { void refresh(); }, []);

  const send = async () => {
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      await submitReport({ type, severity, title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      await refresh();
      toast.success("Ticket envoyé");
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") window.location.href = "/auth";
      else toast.error("Le ticket n’a pas pu être envoyé");
    } finally {
      setPending(false);
    }
  };

  return (
    <AppLayout subtitle="Support">
      <div className="product-page">
        <div className="product-page-heading"><div><h1>Signaler un problème</h1><p>Décrivez précisément ce qui s’est passé et suivez la résolution depuis l’application.</p></div></div>
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)]" style={{ alignItems: "start" }}>
          <section className="ap-card" style={{ padding: 22, display: "grid", gap: 18 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ marginBottom: 9, fontWeight: 900, fontSize: 13 }}>Type de demande</legend><div className="grid gap-2 sm:grid-cols-3">{TYPES.map(({ key, label, detail, icon: Icon }) => <button key={key} type="button" className={type === key ? "ap-btn" : "ap-btn ap-btn--ghost"} onClick={() => setType(key)} style={{ minHeight: 76, display: "grid", justifyItems: "start", alignContent: "center", textAlign: "left" }}><span style={{ display: "flex", alignItems: "center", gap: 7 }}><Icon size={16} />{label}</span><small style={{ opacity: .72 }}>{detail}</small></button>)}</div></fieldset>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ marginBottom: 9, fontWeight: 900, fontSize: 13 }}>Gravité</legend><div className="grid gap-2 sm:grid-cols-3">{SEVERITIES.map(({ key, label, detail }) => <button key={key} type="button" className={severity === key ? "ap-btn" : "ap-btn ap-btn--ghost"} onClick={() => setSeverity(key)} style={{ minHeight: 66, display: "grid", justifyItems: "start", alignContent: "center", textAlign: "left" }}><span>{label}</span><small style={{ opacity: .72 }}>{detail}</small></button>)}</div></fieldset>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 900 }}>Titre<input className="ap-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Résumez le problème en une phrase" /></label>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 900 }}>Ce qui s’est passé<textarea className="ap-input" value={body} onChange={(event) => setBody(event.target.value)} rows={7} placeholder={"1. J’ai effectué…\n2. J’ai obtenu…\n3. Je m’attendais à…"} style={{ resize: "vertical", minHeight: 150 }} /></label>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ justifyContent: "center", minHeight: 74, borderStyle: "dashed" }} onClick={() => toast.info("L’ajout de pièces jointes sera disponible prochainement")}><Upload size={18} /> Ajouter une capture ou une vidéo</button>
            <button className="ap-btn" disabled={!title.trim() || pending} onClick={() => void send()}><Send size={16} />{pending ? "Envoi…" : "Envoyer le ticket"}</button>
          </section>
          <aside style={{ display: "grid", gap: 14 }}>
            <section className="ap-card" style={{ padding: 18 }}><h2 className="ap-h3" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, marginBottom: 12 }}><Ticket size={17} /> Mes tickets</h2>{reports.length === 0 ? <p className="ap-muted" style={{ fontSize: 13 }}>Aucun ticket pour le moment.</p> : <div style={{ display: "grid", gap: 9 }}>{reports.map((report) => <div key={report.id} style={{ paddingTop: 9, borderTop: "var(--ap-border-w) solid var(--ap-line)" }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><strong style={{ fontSize: 13 }}>{report.shortId}</strong><span className="ap-pill" style={{ marginLeft: "auto", fontSize: 10 }}>{report.statusLabel}</span></div><p style={{ margin: "4px 0 2px", fontSize: 13, fontWeight: 800 }}>{report.title}</p><small className="ap-muted">{report.meta}</small></div>)}</div>}</section>
            <section className="ap-card" style={{ padding: 18 }}><h2 className="ap-h3" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, marginBottom: 10 }}><CircleAlert size={17} /> Délais indicatifs</h2><div className="ap-muted" style={{ display: "grid", gap: 7, fontSize: 13 }}><span>Bloquant <strong style={{ float: "right", color: "var(--ap-ink)" }}>&lt; 2 h ouvrées</strong></span><span>Gênant <strong style={{ float: "right", color: "var(--ap-ink)" }}>&lt; 24 h</strong></span><span>Mineur <strong style={{ float: "right", color: "var(--ap-ink)" }}>&lt; 48 h</strong></span></div></section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
