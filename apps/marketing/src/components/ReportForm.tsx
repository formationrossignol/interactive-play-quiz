"use client";

import { useState, useEffect } from "react";
import { Info, Upload } from "lucide-react";
import { submitReport, fetchMyReports, requireAuth } from "@/lib/interactionsRepo";
import type { ReportType, ReportSeverity, MyReport } from "@/lib/types";

const TYPES = [
  { key: "bug", emoji: "🐛", label: "Bug", sub: "Quelque chose est cassé" },
  { key: "question", emoji: "❓", label: "Question", sub: "Besoin d'aide" },
  { key: "billing", emoji: "💳", label: "Facturation", sub: "Paiement, facture" },
];

const SEVS = [
  { s: "1", emoji: "🔴", label: "Bloquant", sub: "Session/examen impossible" },
  { s: "2", emoji: "🟠", label: "Gênant", sub: "Contournable mais pénible" },
  { s: "3", emoji: "⚪", label: "Mineur", sub: "Cosmétique, suggestion" },
];

export function ReportForm() {
  const [type, setType] = useState("bug");
  const [sev, setSev] = useState("2");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [tickets, setTickets] = useState<MyReport[] | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    fetchMyReports().then((r) => { setTickets(r); setTicketsLoading(false); });
  }, []);

  const known = /code|invalide|rejoindre/i.test(title);

  const onSubmit = async () => {
    if (!title.trim() || pending) return;
    if (!(await requireAuth())) return;
    setPending(true);
    try {
      await submitReport({ type: type as ReportType, severity: Number(sev) as ReportSeverity, title: title.trim(), body });
      setTitle(""); setBody(""); setSent(true);
      setTimeout(() => setSent(false), 3000);
      const refreshed = await fetchMyReports();
      setTickets(refreshed);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bug-grid">
      <div className="card bugform">
        <div className="field">
          <label>De quoi s&apos;agit-il ?</label>
          <div className="seg">
            {TYPES.map((tp) => (
              <button key={tp.key} className={type === tp.key ? "on" : ""} onClick={() => setType(tp.key)}>
                {tp.emoji}<span>{tp.label}</span><small>{tp.sub}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Gravité</label>
          <div className="seg">
            {SEVS.map((sv) => (
              <button key={sv.s} className={sev === sv.s ? `on-sev${sv.s}` : ""} onClick={() => setSev(sv.s)}>
                {sv.emoji}<span>{sv.label}</span><small>{sv.sub}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. : les joueurs voient « code invalide » alors que la session est ouverte"
          />
          <div className={`known${known ? " show" : ""}`}>
            <Info size={17} strokeWidth={2.4} style={{ marginTop: "1px" }} />
            <div>
              Problème peut-être déjà connu : « Code invalide juste après la création de session »
              <small>
                Statut : correctif en cours, déploiement prévu cette semaine.{" "}
                <a href="/roadmap">Suivre ce problème</a> au lieu de créer un ticket ?
              </small>
            </div>
          </div>
        </div>

        <div className="field">
          <label>Ce qui s&apos;est passé</label>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"1. J'ai lancé la session…\n2. Les joueurs ont saisi le code…\n3. Résultat : … / Attendu : …"} />
          <p className="fhint">Astuce : les étapes numérotées « fait → obtenu → attendu » divisent le temps de résolution par deux.</p>
        </div>

        <div className="field">
          <label>Capture d&apos;écran ou vidéo (optionnel)</label>
          <div className="dropzone">
            <Upload size={20} strokeWidth={2.2} style={{ marginBottom: "5px" }} />
            <br />
            Glissez un fichier ici, ou cliquez — PNG, JPG, MP4, 20 Mo max
          </div>
        </div>

        <div className="field">
          <label>Contexte technique</label>
          <div className="ctxbox">
            <label><input type="checkbox" defaultChecked /> Joindre automatiquement ces informations</label>
            Navigateur : Chrome 138 · macOS 15.5<br />
            Compte : loic@formation.fr (Pro) · Session : 724913<br />
            Page : /quiz/724913 · 13 juil. 2026, 15:42 CET
          </div>
        </div>

        <button className="btn" style={{ width: "100%" }} disabled={pending || !title.trim()} onClick={onSubmit}>
          {sent ? "Ticket envoyé ✓" : "Envoyer le ticket"}
        </button>
        <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: "12px", textAlign: "center", margin: "12px 0 0" }}>
          Vous recevrez un numéro de suivi par email immédiatement.
        </p>
      </div>

      <div>
        <div className="card" style={{ overflow: "hidden", position: "relative" }}>
          <div style={{ padding: "16px 18px 8px" }}><h3 style={{ fontSize: "16px" }}>Mes tickets</h3></div>
          {ticketsLoading ? (
            <div className="ticketrow"><small style={{ opacity: 0.6 }}>Chargement…</small></div>
          ) : !tickets || tickets.length === 0 ? (
            <div className="ticketrow"><small style={{ opacity: 0.6 }}>Aucun ticket pour le moment.</small></div>
          ) : (
            tickets.map((tk) => (
              <div className="ticketrow" key={tk.id}>
                <span className="tid">{tk.shortId}</span>
                <div className="tt2"><b>{tk.title}</b><small>{tk.meta}</small></div>
                <span className={`tst ${tk.statusClass}`}>{tk.statusLabel}</span>
              </div>
            ))
          )}
        </div>

        <div className="card slabox">
          <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>⏱ Nos délais de réponse</h3>
          <div className="srow">🔴 Bloquant (session/examen)<b>&lt; 2 h ouvrées</b></div>
          <div className="srow">🟠 Gênant<b>&lt; 24 h ouvrées</b></div>
          <div className="srow">⚪ Mineur &amp; questions<b>&lt; 48 h ouvrées</b></div>
          <p style={{ margin: "11px 0 0", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)" }}>
            Un examen en cours qui plante ? Utilisez le bouton « SOS » directement dans l&apos;écran de session : priorité absolue.
          </p>
        </div>
      </div>
    </div>
  );
}
