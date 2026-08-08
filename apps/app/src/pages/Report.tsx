import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSEO } from "@/hooks/useSEO";
import { fetchMyReports, submitReport } from "@/lib/pages/publicRepo";
import type { MyReport, ReportSeverity, ReportType } from "@/lib/pages/types";

const TYPES: { key: ReportType; label: string; detail: string; icon: string }[] = [
  { key: "bug", label: "Bug", detail: "Quelque chose est cassé", icon: "bug_report" },
  { key: "question", label: "Question", detail: "Besoin d’aide", icon: "help" },
  { key: "billing", label: "Facturation", detail: "Paiement ou facture", icon: "credit_card" },
];
const SEVERITIES: { key: ReportSeverity; label: string; detail: string }[] = [
  { key: 1, label: "Bloquant", detail: "Session ou examen impossible" },
  { key: 2, label: "Gênant", detail: "Un contournement existe" },
  { key: 3, label: "Mineur", detail: "Cosmétique ou suggestion" },
];

const STATUS_TILES = [
  { key: "total", label: "Total des tickets", icon: "confirmation_number", tone: "primary" },
  { key: "progress", label: "En cours", icon: "hourglass_top", tone: "warning" },
  { key: "open", label: "Ouverts", icon: "mark_email_unread", tone: "success" },
  { key: "resolved", label: "Résolus", icon: "task_alt", tone: "danger" },
] as const;

export default function Report() {
  const [type, setType] = useState<ReportType>("bug");
  const [severity, setSeverity] = useState<ReportSeverity>(2);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  useSEO({ title: "Signaler un problème", description: "Décrivez un problème et suivez sa résolution.", path: "/report" });

  const refresh = () => fetchMyReports().then(setReports).catch(() => toast.error("Impossible de charger vos tickets"));
  useEffect(() => { void refresh(); }, []);

  const counts = useMemo(() => ({
    total: reports.length,
    progress: reports.filter((report) => report.statusClass === "is-progress" || report.statusClass === "is-waiting").length,
    open: reports.filter((report) => report.statusClass === "is-open").length,
    resolved: reports.filter((report) => report.statusClass === "is-resolved").length,
  }), [reports]);

  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    if (!normalized) return reports;
    return reports.filter((report) => `${report.shortId} ${report.title} ${report.meta} ${report.statusLabel}`.toLocaleLowerCase("fr").includes(normalized));
  }, [query, reports]);

  const send = async () => {
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      await submitReport({ type, severity, title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setComposerOpen(false);
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
    <AppLayout subtitle="Tickets">
      <div className="product-page product-ticket-page">
        <PageHeader
          title="Tickets"
          eyebrow="Support"
          description="Signalez un problème et suivez sa résolution depuis votre espace."
          action={<span className="product-ticket-period"><small>Temps de réponse</small><strong>&lt; 24 h</strong></span>}
        />

        <section className="product-ticket-stats" aria-label="Statistiques des tickets">
          {STATUS_TILES.map((tile) => (
            <article key={tile.key} className="product-ticket-stat" data-tone={tile.tone}>
              <span className="product-ticket-stat__icon"><MaterialSymbol name={tile.icon} size={23} /></span>
              <span><strong>{counts[tile.key]}</strong><small>{tile.label}</small></span>
            </article>
          ))}
        </section>

        <section className="ap-card product-ticket-toolbar" aria-label="Actions des tickets">
          <div className="product-ticket-search">
            <MaterialSymbol name="search" size={19} />
            <Input aria-label="Rechercher un ticket" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans mes tickets" />
          </div>
          <Button onClick={() => setComposerOpen(true)}><MaterialSymbol name="add" size={18} /> Nouveau ticket</Button>
        </section>

        <section className="ap-card product-ticket-table-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="product-ticket-empty">
                    <MaterialSymbol name={query ? "search_off" : "confirmation_number"} size={32} />
                    <strong>{query ? "Aucun résultat" : "Aucun ticket pour le moment"}</strong>
                    <span>{query ? "Modifiez votre recherche." : "Créez votre premier ticket pour contacter le support."}</span>
                    {!query && <Button size="sm" onClick={() => setComposerOpen(true)}>Créer un ticket</Button>}
                  </TableCell>
                </TableRow>
              ) : visibleReports.map((report) => {
                const [category, date] = report.meta.split(" · ");
                return (
                  <TableRow key={report.id}>
                    <TableCell><strong>{report.shortId}</strong></TableCell>
                    <TableCell><strong className="product-ticket-title">{report.title}</strong><small>{date}</small></TableCell>
                    <TableCell>{category}</TableCell>
                    <TableCell><span className="product-ticket-status" data-status={report.statusClass.replace("is-", "")}>{report.statusLabel}</span></TableCell>
                    <TableCell className="text-right"><button className="product-row-action" type="button" title="Consulter le ticket" aria-label={`Consulter ${report.shortId}`} onClick={() => toast.info(`Le suivi détaillé de ${report.shortId} sera bientôt disponible.`)}><MaterialSymbol name="open_in_new" size={17} /></button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <footer className="product-ticket-table-footer">
            <span>{visibleReports.length} ticket{visibleReports.length > 1 ? "s" : ""}</span>
            <div><button type="button" disabled aria-label="Page précédente"><MaterialSymbol name="chevron_left" size={20} /></button><strong>1</strong><button type="button" disabled aria-label="Page suivante"><MaterialSymbol name="chevron_right" size={20} /></button></div>
          </footer>
        </section>

        <section className="product-ticket-sla" aria-label="Délais indicatifs">
          <span><MaterialSymbol name="priority_high" size={18} /><strong>Bloquant</strong><small>&lt; 2 h ouvrées</small></span>
          <span><MaterialSymbol name="schedule" size={18} /><strong>Gênant</strong><small>&lt; 24 h</small></span>
          <span><MaterialSymbol name="low_priority" size={18} /><strong>Mineur</strong><small>&lt; 48 h</small></span>
        </section>

        <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
          <DialogContent className="product-ticket-dialog sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle>Nouveau ticket</DialogTitle>
              <DialogDescription>Donnez au support les éléments nécessaires pour reproduire votre problème.</DialogDescription>
            </DialogHeader>
            <div className="product-ticket-form">
              <fieldset><legend>Type de demande</legend><div className="product-ticket-options">{TYPES.map(({ key, label, detail, icon }) => <button key={key} type="button" data-active={type === key || undefined} onClick={() => setType(key)}><MaterialSymbol name={icon} size={19} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}</div></fieldset>
              <fieldset><legend>Gravité</legend><div className="product-ticket-options product-ticket-options--severity">{SEVERITIES.map(({ key, label, detail }) => <button key={key} type="button" aria-label={`${label} — ${detail}`} data-active={severity === key || undefined} onClick={() => setSeverity(key)}><span className="product-ticket-severity-dot" data-severity={key} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}</div></fieldset>
              <label htmlFor="ticket-title">Titre<Input id="ticket-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Résumez le problème en une phrase" /></label>
              <label htmlFor="ticket-body">Ce qui s’est passé<Textarea id="ticket-body" value={body} onChange={(event) => setBody(event.target.value)} rows={6} placeholder={"1. J’ai effectué…\n2. J’ai obtenu…\n3. Je m’attendais à…"} /></label>
              <button type="button" className="product-ticket-upload" onClick={() => toast.info("L’ajout de pièces jointes sera disponible prochainement")}><MaterialSymbol name="cloud_upload" size={23} /><span><strong>Ajouter une capture ou une vidéo</strong><small>PNG, JPG ou MP4 — bientôt disponible</small></span></button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposerOpen(false)}>Annuler</Button>
              <Button disabled={!title.trim() || pending} onClick={() => void send()}><MaterialSymbol name="send" size={17} />{pending ? "Envoi…" : "Envoyer le ticket"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
