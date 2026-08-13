import { useEffect, useState } from "react";
import { BarChart3, Check, Copy, Lock, Mail, MessageCircleQuestion, MonitorPlay, Plus, Radio, Square, Trash2, UserX, Unlock, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { supabase } from "@/lib/supabase";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  activateLiveEvent,
  addAllowlistEmail,
  closeLiveInteraction,
  createBrainstormInteraction,
  createLiveEvent,
  createLiveRun,
  createMatrixInteraction,
  createPollInteraction,
  createPriorityInteraction,
  createRankingInteraction,
  getLiveModerationSettings,
  getSessionReport,
  kickParticipant,
  listEventAllowlist,
  listEventRunSummaries,
  listInteractionResponses,
  listOrgLiveEvents,
  listLatestRun,
  listRunInteractions,
  listRunParticipants,
  listRunQuestions,
  moderateQuestion,
  openLiveInteraction,
  removeAllowlistEmail,
  setLiveModerationSettings,
  setRunLocked,
  updateInteractionConfig,
  type AllowlistEntry,
  type AudienceQuestion,
  type BrainstormConfig,
  type BrainstormPayload,
  type EventRunSummary,
  type LiveEvent,
  type LiveInteraction,
  type LiveModerationSettings,
  type LiveParticipantRow,
  type LiveRun,
  type MatrixConfig,
  type MatrixPayload,
  type PollConfig,
  type PollResponsePayload,
  type PriorityConfig,
  type PriorityPayload,
  type RankingConfig,
  type RankingPayload,
  type SessionReport,
} from "@/lib/lms/liveEngagement";
import { exportSessionReport, type LiveSessionReportExportFormat } from "@/lib/lms/liveSessionReportExport";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);

function QuestionModeration({ run }: { run: LiveRun }) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => listRunQuestions(run.id).then(setQuestions).catch(showError).finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  const handleModerate = async (id: string, action: "approved" | "dismissed" | "marked_answered") => {
    try {
      await moderateQuestion(id, action);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground mt-2">Aucune question pour le run en cours.</p>;
  }

  return (
    <ul className="space-y-2 mt-3">
      {questions.map((q) => (
        <li key={q.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>{q.body}</span>
            <span className="text-muted-foreground">{q.votes_count} votes · {q.status}</span>
          </div>
          {q.flagged_terms && q.flagged_terms.length > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--ap-danger)" }}>⚠ Termes signalés (assistance) : {q.flagged_terms.join(", ")}</p>
          )}
          {q.status === "pending" && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={() => handleModerate(q.id, "approved")}>Approuver</Button>
              <Button size="sm" variant="ghost" onClick={() => handleModerate(q.id, "dismissed")}>Refuser</Button>
            </div>
          )}
          {q.status === "approved" && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={() => handleModerate(q.id, "marked_answered")}>Marquer répondu</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PollResults({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as PollConfig;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [respondents, setRespondents] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listInteractionResponses(interaction.id)
      .then((rows) => {
        const next: Record<string, number> = {};
        for (const option of config.options) next[option.id] = 0;
        for (const row of rows) {
          const payload = row.payload as PollResponsePayload;
          for (const optionId of payload.optionIds ?? []) {
            next[optionId] = (next[optionId] ?? 0) + 1;
          }
        }
        setCounts(next);
        setRespondents(rows.length);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (interaction.status !== "live") return;
    const channel = supabase
      .channel(`lms-live-interaction-${interaction.id}-responses`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_responses", filter: `interaction_id=eq.${interaction.id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id, interaction.status]);

  if (loading) return <TableSkeleton rows={2} cols={1} />;

  const total = Math.max(1, Object.values(counts).reduce((sum, n) => sum + n, 0));

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs text-muted-foreground">{respondents} réponse{respondents !== 1 ? "s" : ""}</p>
      {config.options.map((option) => {
        const count = counts[option.id] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={option.id} className="text-sm">
            <div className="flex items-center justify-between"><span>{option.label}</span><span className="text-muted-foreground">{count} ({pct}%)</span></div>
            <div className="h-1.5 rounded-full bg-muted mt-0.5 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** LIVE-009: average points allocated per option, out of the configured budget. */
function PriorityResults({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as PriorityConfig;
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [respondents, setRespondents] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listInteractionResponses(interaction.id)
      .then((rows) => {
        const next: Record<string, number> = {};
        for (const option of config.options) next[option.id] = 0;
        for (const row of rows) {
          const payload = row.payload as PriorityPayload;
          for (const [optionId, points] of Object.entries(payload.allocations ?? {})) {
            next[optionId] = (next[optionId] ?? 0) + points;
          }
        }
        setTotals(next);
        setRespondents(rows.length);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (interaction.status !== "live") return;
    const channel = supabase
      .channel(`lms-live-interaction-${interaction.id}-responses`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_responses", filter: `interaction_id=eq.${interaction.id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id, interaction.status]);

  if (loading) return <TableSkeleton rows={2} cols={1} />;

  const maxTotal = Math.max(1, ...Object.values(totals));

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs text-muted-foreground">{respondents} réponse{respondents !== 1 ? "s" : ""} · budget {config.budget} pts</p>
      {config.options.map((option) => {
        const total = totals[option.id] ?? 0;
        const avg = respondents > 0 ? (total / respondents).toFixed(1) : "0";
        return (
          <div key={option.id} className="text-sm">
            <div className="flex items-center justify-between"><span>{option.label}</span><span className="text-muted-foreground">{avg} pts/participant</span></div>
            <div className="h-1.5 rounded-full bg-muted mt-0.5 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((total / maxTotal) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** LIVE-010: average (x,y) placement per option, plotted on a simple grid. */
function MatrixResults({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as MatrixConfig;
  const [averages, setAverages] = useState<Record<string, { x: number; y: number; n: number }>>({});
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listInteractionResponses(interaction.id)
      .then((rows) => {
        const sums: Record<string, { x: number; y: number; n: number }> = {};
        for (const row of rows) {
          const payload = row.payload as MatrixPayload;
          for (const [optionId, point] of Object.entries(payload.placements ?? {})) {
            const cur = sums[optionId] ?? { x: 0, y: 0, n: 0 };
            sums[optionId] = { x: cur.x + point.x, y: cur.y + point.y, n: cur.n + 1 };
          }
        }
        const next: Record<string, { x: number; y: number; n: number }> = {};
        for (const [optionId, s] of Object.entries(sums)) next[optionId] = { x: s.x / s.n, y: s.y / s.n, n: s.n };
        setAverages(next);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (interaction.status !== "live") return;
    const channel = supabase
      .channel(`lms-live-interaction-${interaction.id}-responses`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_responses", filter: `interaction_id=eq.${interaction.id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id, interaction.status]);

  if (loading) return <TableSkeleton rows={2} cols={1} />;

  return (
    <div className="mt-2 space-y-2">
      <div className="relative w-full aspect-square max-w-[280px] rounded-md border" style={{ background: "var(--ap-paper-2)" }}>
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{config.yAxisLabel} +</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{config.yAxisLabel} −</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ writingMode: "vertical-rl" }}>{config.xAxisLabel} −</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ writingMode: "vertical-rl" }}>{config.xAxisLabel} +</span>
        <div className="absolute inset-x-0 top-1/2 border-t" style={{ borderColor: "var(--ap-line)" }} />
        <div className="absolute inset-y-0 left-1/2 border-l" style={{ borderColor: "var(--ap-line)" }} />
        {config.options.map((option) => {
          const avg = averages[option.id];
          if (!avg) return null;
          const left = 50 + (avg.x / 100) * 45;
          const top = 50 - (avg.y / 100) * 45;
          return (
            <div
              key={option.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 whitespace-nowrap"
              style={{ left: `${left}%`, top: `${top}%` }}
              title={`${option.label} (n=${avg.n})`}
            >
              {option.label}
            </div>
          );
        })}
      </div>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {config.options.map((o) => (
          <li key={o.id}>{o.label} : {averages[o.id] ? `x=${averages[o.id].x.toFixed(0)}, y=${averages[o.id].y.toFixed(0)} (n=${averages[o.id].n})` : "aucune réponse"}</li>
        ))}
      </ul>
    </div>
  );
}

/** LIVE-011: ideas listed with vote counts, staff assigns a category per
 *  idea (stored in the interaction's own config, updateInteractionConfig()),
 *  simple CSV export. */
function BrainstormResults({ interaction, onConfigChange }: { interaction: LiveInteraction; onConfigChange: (next: LiveInteraction) => void }) {
  const config = interaction.config as BrainstormConfig;
  const [ideas, setIdeas] = useState<Array<{ id: string; text: string; votes: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);

  const reload = () => {
    listInteractionResponses(interaction.id)
      .then((rows) => {
        const byId = new Map<string, { id: string; text: string; votes: number }>();
        for (const row of rows) {
          const payload = row.payload as BrainstormPayload;
          for (const idea of payload.ideas ?? []) {
            if (!byId.has(idea.id)) byId.set(idea.id, { id: idea.id, text: idea.text, votes: 0 });
          }
        }
        for (const row of rows) {
          const payload = row.payload as BrainstormPayload;
          for (const ideaId of payload.votes ?? []) {
            const idea = byId.get(ideaId);
            if (idea) idea.votes++;
          }
        }
        setIdeas([...byId.values()].sort((a, b) => b.votes - a.votes));
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (interaction.status !== "live") return;
    const channel = supabase
      .channel(`lms-live-interaction-${interaction.id}-responses`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_responses", filter: `interaction_id=eq.${interaction.id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id, interaction.status]);

  const handleSetCategory = async (ideaId: string, category: string) => {
    setSavingCategory(ideaId);
    try {
      const nextConfig: BrainstormConfig = { ...config, categories: { ...config.categories, [ideaId]: category } };
      await updateInteractionConfig(interaction.id, nextConfig);
      onConfigChange({ ...interaction, config: nextConfig });
    } catch (err) {
      showError(err);
    } finally {
      setSavingCategory(null);
    }
  };

  const handleExportCsv = () => {
    const rows = ideas.map((i) => [i.text, config.categories?.[i.id] ?? "", i.votes]);
    const csv = [["Idée", "Catégorie", "Votes"], ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "brainstorm.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <TableSkeleton rows={2} cols={1} />;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{ideas.length} idée{ideas.length !== 1 ? "s" : ""}</p>
        <Button variant="ghost" size="sm" onClick={handleExportCsv}>Exporter (CSV)</Button>
      </div>
      {ideas.length === 0 ? <p className="text-sm text-muted-foreground">Aucune idée pour l'instant.</p> : (
        <ul className="space-y-1">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="flex-1">{idea.text} <span className="text-muted-foreground">· {idea.votes} vote{idea.votes !== 1 ? "s" : ""}</span></span>
              <Input
                placeholder="Catégorie"
                defaultValue={config.categories?.[idea.id] ?? ""}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== (config.categories?.[idea.id] ?? "")) void handleSetCategory(idea.id, e.target.value.trim()); }}
                className="w-32 h-8 text-xs"
                disabled={savingCategory === idea.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** LIVE-012: average rank position per option (1 = top). If a matching
 *  question with the opposite phase also exists on this run, shows an
 *  avant/après comparison — see RankingConfig's doc comment for why this
 *  is two interactions rather than one. */
function RankingResults({ interaction, allInteractions }: { interaction: LiveInteraction; allInteractions: LiveInteraction[] }) {
  const config = interaction.config as RankingConfig;
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [respondents, setRespondents] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listInteractionResponses(interaction.id)
      .then((rows) => {
        const sums: Record<string, number> = {};
        for (const row of rows) {
          const payload = row.payload as RankingPayload;
          (payload.order ?? []).forEach((optionId, position) => {
            sums[optionId] = (sums[optionId] ?? 0) + (position + 1);
          });
        }
        const next: Record<string, number> = {};
        for (const [optionId, sum] of Object.entries(sums)) next[optionId] = sum / rows.length;
        setAverages(next);
        setRespondents(rows.length);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    if (interaction.status !== "live") return;
    const channel = supabase
      .channel(`lms-live-interaction-${interaction.id}-responses`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_responses", filter: `interaction_id=eq.${interaction.id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id, interaction.status]);

  if (loading) return <TableSkeleton rows={2} cols={1} />;

  const otherPhase = config.phase === "before" ? "after" : config.phase === "after" ? "before" : null;
  const counterpart = otherPhase
    ? allInteractions.find((i) => i.id !== interaction.id && i.kind === "ranking" && (i.config as RankingConfig).question === config.question && (i.config as RankingConfig).phase === otherPhase)
    : undefined;

  const sorted = [...config.options].sort((a, b) => (averages[a.id] ?? 99) - (averages[b.id] ?? 99));

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs text-muted-foreground">{respondents} réponse{respondents !== 1 ? "s" : ""} · rang moyen (1 = mieux classé){config.phase ? ` · phase « ${config.phase === "before" ? "avant" : "après"} »` : ""}</p>
      <ol className="space-y-1">
        {sorted.map((option, i) => (
          <li key={option.id} className="flex items-center justify-between text-sm">
            <span>{i + 1}. {option.label}</span>
            <span className="text-muted-foreground">{averages[option.id] ? averages[option.id].toFixed(1) : "—"}</span>
          </li>
        ))}
      </ol>
      {counterpart && (
        <p className="text-xs text-muted-foreground border-t pt-1.5">Comparaison disponible avec l'interaction « {config.question} » (phase {otherPhase === "before" ? "avant" : "après"}) — dépliez-la pour voir son classement.</p>
      )}
    </div>
  );
}

type InteractionKind = LiveInteraction["kind"];

const interactionKindFormLabel: Record<InteractionKind, string> = {
  poll: "Sondage", priority: "Priorisation", matrix: "Matrice 2×2", brainstorm: "Brainstorm", ranking: "Classement forcé",
};

/** Generic creation form: kind selector + per-kind fields. Every kind
 *  shares the option-list editor (poll/priority/matrix/ranking all
 *  operate on a list of labeled options); brainstorm has none (open
 *  ideas). See liveEngagement.ts's config type doc comments for exactly
 *  what each kind needs. */
function CreateInteractionForm({ runId, onCreated }: { runId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<InteractionKind>("poll");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [budget, setBudget] = useState("100");
  const [xAxisLabel, setXAxisLabel] = useState("");
  const [yAxisLabel, setYAxisLabel] = useState("");
  const [phase, setPhase] = useState<"" | "before" | "after">("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const updateOption = (index: number, value: string) => setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (index: number) => setOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));

  const resetForm = () => {
    setQuestion(""); setOptions(["", ""]); setAllowMultiple(false); setBudget("100");
    setXAxisLabel(""); setYAxisLabel(""); setPhase(""); setOpen(false); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!question.trim()) return;
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    const optionRows = cleanOptions.map((label, i) => ({ id: `opt-${i}-${Date.now()}`, label }));
    setCreating(true);
    try {
      if (kind === "poll") {
        if (cleanOptions.length < 2) { setFormError("Au moins 2 options requises."); return; }
        await createPollInteraction(runId, { question: question.trim(), options: optionRows, allowMultiple });
      } else if (kind === "priority") {
        if (cleanOptions.length < 2) { setFormError("Au moins 2 options requises."); return; }
        const budgetNum = Number(budget) || 100;
        await createPriorityInteraction(runId, { question: question.trim(), options: optionRows, budget: budgetNum });
      } else if (kind === "matrix") {
        if (cleanOptions.length < 1) { setFormError("Au moins 1 option requise."); return; }
        if (!xAxisLabel.trim() || !yAxisLabel.trim()) { setFormError("Les deux axes sont requis."); return; }
        await createMatrixInteraction(runId, { question: question.trim(), options: optionRows, xAxisLabel: xAxisLabel.trim(), yAxisLabel: yAxisLabel.trim() });
      } else if (kind === "brainstorm") {
        await createBrainstormInteraction(runId, { question: question.trim() });
      } else {
        if (cleanOptions.length < 2) { setFormError("Au moins 2 options requises."); return; }
        await createRankingInteraction(runId, { question: question.trim(), options: optionRows, phase: phase || undefined });
      }
      resetForm();
      onCreated();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (!open) {
    return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Créer une interaction</Button>;
  }

  const needsOptions = kind !== "brainstorm";

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-3 space-y-2">
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={kind}
        onChange={(e) => setKind(e.target.value as InteractionKind)}
        aria-label="Type d'interaction"
      >
        {(Object.keys(interactionKindFormLabel) as InteractionKind[]).map((k) => <option key={k} value={k}>{interactionKindFormLabel[k]}</option>)}
      </select>
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" required />

      {kind === "matrix" && (
        <div className="flex items-center gap-2">
          <Input value={xAxisLabel} onChange={(e) => setXAxisLabel(e.target.value)} placeholder="Axe X (ex. Urgence)" />
          <Input value={yAxisLabel} onChange={(e) => setYAxisLabel(e.target.value)} placeholder="Axe Y (ex. Impact)" />
        </div>
      )}

      {kind === "priority" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="priority-budget">Budget de points</label>
          <Input id="priority-budget" type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} className="w-24" />
        </div>
      )}

      {kind === "ranking" && (
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={phase} onChange={(e) => setPhase(e.target.value as "" | "before" | "after")}>
          <option value="">Sans phase</option>
          <option value="before">Phase « avant »</option>
          <option value="after">Phase « après »</option>
        </select>
      )}

      {needsOptions && options.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={value} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
          {options.length > 2 && (
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer" onClick={() => removeOption(i)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      {needsOptions && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={addOption}><Plus size={14} /> Option</Button>
          {kind === "poll" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} /> Plusieurs réponses autorisées
            </label>
          )}
        </div>
      )}
      {kind === "brainstorm" && <p className="text-xs text-muted-foreground">Les participants proposent librement des idées — pas d'options prédéfinies.</p>}

      {formError && <p className="text-sm" style={{ color: "var(--ap-danger)" }}>{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button type="submit" size="sm" loading={creating}>Créer</Button>
      </div>
    </form>
  );
}

function InteractionManager({ run }: { run: LiveRun }) {
  const [interactions, setInteractions] = useState<LiveInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const reload = () => listRunInteractions(run.id).then(setInteractions).catch(showError).finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  const handleOpen = async (id: string) => {
    setActingId(id);
    try {
      await openLiveInteraction(id);
      await reload();
      setExpandedId(id);
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };

  const handleClose = async (id: string) => {
    setActingId(id);
    try {
      await closeLiveInteraction(id);
      await reload();
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };

  const handleConfigChange = (next: LiveInteraction) => {
    setInteractions((prev) => prev.map((i) => (i.id === next.id ? next : i)));
  };

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 size={14} /> Interactions</p>
      </div>
      {loading ? <TableSkeleton rows={1} cols={1} /> : (
        <div className="space-y-2">
          {interactions.map((interaction) => {
            const config = interaction.config as { question: string };
            return (
              <div key={interaction.id} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="text-left text-sm flex-1" onClick={() => setExpandedId((cur) => (cur === interaction.id ? null : interaction.id))}>
                    {interactionKindFormLabel[interaction.kind]} — {config.question} <span className="text-muted-foreground">· {interaction.status}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {interaction.status !== "live" && (
                      <Button variant="ghost" size="sm" loading={actingId === interaction.id} onClick={() => void handleOpen(interaction.id)}>
                        <Radio size={14} /> Ouvrir
                      </Button>
                    )}
                    {interaction.status === "live" && (
                      <Button variant="ghost" size="sm" loading={actingId === interaction.id} onClick={() => void handleClose(interaction.id)}>
                        <Square size={14} /> Fermer
                      </Button>
                    )}
                  </div>
                </div>
                {expandedId === interaction.id && (
                  <>
                    {interaction.kind === "poll" && <PollResults interaction={interaction} />}
                    {interaction.kind === "priority" && <PriorityResults interaction={interaction} />}
                    {interaction.kind === "matrix" && <MatrixResults interaction={interaction} />}
                    {interaction.kind === "brainstorm" && <BrainstormResults interaction={interaction} onConfigChange={handleConfigChange} />}
                    {interaction.kind === "ranking" && <RankingResults interaction={interaction} allInteractions={interactions} />}
                  </>
                )}
              </div>
            );
          })}
          <CreateInteractionForm runId={run.id} onCreated={reload} />
        </div>
      )}
    </div>
  );
}

function ParticipantManager({ runId }: { runId: string }) {
  const [participants, setParticipants] = useState<LiveParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const reload = () => listRunParticipants(runId).then(setParticipants).catch(showError).finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const handleKick = async (participantId: string) => {
    setKickingId(participantId);
    try {
      await kickParticipant(participantId);
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, status: "kicked" } : p)));
    } catch (err) {
      showError(err);
    } finally {
      setKickingId(null);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  const active = participants.filter((p) => p.status === "active");
  if (active.length === 0) return <p className="text-sm text-muted-foreground mt-2">Aucun participant actif.</p>;

  return (
    <ul className="space-y-1 mt-2" aria-label="Participants">
      {active.map((p) => (
        <li key={p.id} className="flex items-center justify-between text-sm rounded-md border px-3 py-1.5">
          <span>{p.display_name || "Anonyme"}</span>
          <Button variant="ghost" size="sm" loading={kickingId === p.id} onClick={() => handleKick(p.id)}>
            <UserX size={14} /> Expulser
          </Button>
        </li>
      ))}
    </ul>
  );
}

function RunControls({ run, onLockChange }: { run: LiveRun; onLockChange: (locked: boolean) => void }) {
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);
  const [managingParticipants, setManagingParticipants] = useState(false);

  useEffect(() => {
    listRunParticipants(run.id).then((rows) => setParticipantCount(rows.filter((p) => p.status === "active").length)).catch(() => setParticipantCount(null));
  }, [run.id]);

  const handleToggleLock = async () => {
    setToggling(true);
    try {
      await setRunLocked(run.id, !run.locked);
      onLockChange(!run.locked);
    } catch (err) {
      showError(err);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
        <button type="button" className="flex items-center gap-1" onClick={() => setManagingParticipants((v) => !v)}>
          <Users size={14} /> {participantCount ?? "…"}
        </button>
        <Button variant="ghost" size="sm" loading={toggling} onClick={handleToggleLock}>
          {run.locked ? <Unlock size={14} /> : <Lock size={14} />} {run.locked ? "Déverrouiller" : "Verrouiller"}
        </Button>
      </div>
      {managingParticipants && <ParticipantManager runId={run.id} />}
    </div>
  );
}

function JoinLinkBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/live/${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — the code is already visible next to the button.
    }
  };

  return (
    <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={handleCopy} type="button">
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copié" : url}
    </button>
  );
}

/** Only rendered when event.access_policy = 'allowlist' — live_run_allowlist_ok()
 *  (20260812140000) is the actual server-side gate, this is just the CRUD
 *  for the list it reads. */
function AllowlistManager({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const reload = () => listEventAllowlist(eventId).then(setEntries).catch(showError).finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const entry = await addAllowlistEmail(eventId, email.trim());
      setEntries((prev) => [entry, ...prev]);
      setEmail("");
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await removeAllowlistEmail(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      showError(err);
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <TableSkeleton rows={1} cols={1} />;

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5"><Mail size={14} /> Liste autorisée ({entries.length})</p>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input type="email" placeholder="email@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
        <Button variant="ghost" size="sm" type="submit" loading={adding}><Plus size={14} /> Ajouter</Button>
      </form>
      {entries.length > 0 && (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between text-sm rounded-md border px-3 py-1.5">
              <span>{entry.email}</span>
              <Button variant="ghost" size="sm" loading={removingId === entry.id} onClick={() => void handleRemove(entry.id)}>
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** RESTE-A-FAIRE §09: "filtre de termes configurable comme assistance,
 *  jamais suppression invisible" + "rate limits par participant, appareil
 *  et événement" — see 20260813060000_live_moderation_rate_limit_term_filter.sql
 *  for why participant/appareil collapse to the same client_id-scoped
 *  check and why term filtering only covers audience_questions.body. */
function ModerationSettingsPanel({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<Omit<LiveModerationSettings, "event_id" | "updated_at"> | null>(null);
  const [blockedTermsText, setBlockedTermsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLiveModerationSettings(eventId)
      .then((s) => { setSettings(s); setBlockedTermsText(s.blocked_terms.join(", ")); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, blocked_terms: blockedTermsText.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      await setLiveModerationSettings(eventId, next);
      setSettings(next);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <TableSkeleton rows={1} cols={1} />;

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      <p className="text-sm font-medium">Modération : débit et termes signalés</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs" htmlFor={`rl-per-${eventId}`}>Actions / participant</label>
          <Input
            id={`rl-per-${eventId}`} type="number" min={1} className="w-24"
            value={settings.rate_limit_per_window}
            onChange={(e) => setSettings({ ...settings, rate_limit_per_window: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs" htmlFor={`rl-window-${eventId}`}>Fenêtre (s)</label>
          <Input
            id={`rl-window-${eventId}`} type="number" min={1} className="w-24"
            value={settings.rate_limit_window_seconds}
            onChange={(e) => setSettings({ ...settings, rate_limit_window_seconds: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs" htmlFor={`rl-event-${eventId}`}>Actions / événement</label>
          <Input
            id={`rl-event-${eventId}`} type="number" min={1} className="w-24"
            value={settings.event_rate_limit_per_window}
            onChange={(e) => setSettings({ ...settings, event_rate_limit_per_window: Number(e.target.value) || 1 })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor={`terms-${eventId}`}>Termes signalés (séparés par des virgules — assistance, jamais bloquant)</label>
        <Input id={`terms-${eventId}`} value={blockedTermsText} onChange={(e) => setBlockedTermsText(e.target.value)} className="max-w-md" />
      </div>
      <Button variant="ghost" size="sm" loading={saving} onClick={handleSave}>Enregistrer</Button>
    </div>
  );
}

const interactionKindLabel: Record<LiveInteraction["kind"], string> = {
  poll: "Sondage", priority: "Priorisation", matrix: "Matrice", brainstorm: "Brainstorm", ranking: "Classement",
};

/** LIVE-020/021/022/023: post-session report — no new RPC, every table
 *  read here is already staff-readable (see liveEngagement.ts's
 *  getSessionReport() doc comment for the exact RLS reused and the
 *  connection_lost/no_response/not_presented heuristic). */
function SessionReportPanel({ event, run }: { event: LiveEvent; run: LiveRun }) {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparisons, setComparisons] = useState<EventRunSummary[]>([]);
  const [comparing, setComparing] = useState(false);
  const [anonymized, setAnonymized] = useState(false);
  const [exporting, setExporting] = useState<LiveSessionReportExportFormat | null>(null);

  useEffect(() => {
    setLoading(true);
    getSessionReport(run.id).then(setReport).catch(showError).finally(() => setLoading(false));
  }, [run.id]);

  const handleCompare = () => {
    setComparing(true);
    listEventRunSummaries(event.id).then(setComparisons).catch(showError).finally(() => setComparing(false));
  };

  const handleExport = async (format: LiveSessionReportExportFormat) => {
    if (!report) return;
    setExporting(format);
    try {
      await exportSessionReport(format, event, report, anonymized);
    } catch (err) {
      showError(err);
    } finally {
      setExporting(null);
    }
  };

  if (loading || !report) return <TableSkeleton rows={3} cols={2} />;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { label: "Participants", value: report.participants.length },
          { label: "Questions", value: report.questionsCount },
          { label: "Votes", value: report.votesCount },
          { label: "Interactions", value: report.interactions.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border p-2 text-center">
            <strong className="block text-lg">{stat.value}</strong>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {report.interactionBreakdown.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: "var(--ap-paper-2)" }}>
                <th className="px-2 py-1.5 text-left text-xs font-bold">Interaction</th>
                <th className="px-2 py-1.5 text-left text-xs font-bold">Présentée</th>
                <th className="px-2 py-1.5 text-left text-xs font-bold">Répondu</th>
                <th className="px-2 py-1.5 text-left text-xs font-bold">Sans réponse</th>
                <th className="px-2 py-1.5 text-left text-xs font-bold">Connexion perdue</th>
              </tr>
            </thead>
            <tbody>
              {report.interactionBreakdown.map((b) => (
                <tr key={b.interaction_id} style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
                  <td className="px-2 py-1.5">{interactionKindLabel[b.kind] ?? b.kind}</td>
                  <td className="px-2 py-1.5">{b.presented ? "Oui" : "Non"}</td>
                  <td className="px-2 py-1.5">{b.answered_count}</td>
                  <td className="px-2 py-1.5">{b.no_response_count}</td>
                  <td className="px-2 py-1.5">{b.connection_lost_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details>
        <summary className="text-sm font-medium cursor-pointer">Chronologie ({report.timeline.length} événements)</summary>
        <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto">
          {report.timeline.map((t, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-2">
              <span className="shrink-0">{new Date(t.at).toLocaleTimeString("fr-FR")}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={anonymized} onChange={(e) => setAnonymized(e.target.checked)} /> Anonymiser les participants
        </label>
        <Button variant="outline" size="sm" loading={exporting === "CSV"} onClick={() => void handleExport("CSV")}>CSV</Button>
        <Button variant="outline" size="sm" loading={exporting === "Excel"} onClick={() => void handleExport("Excel")}>Excel</Button>
        <Button variant="outline" size="sm" loading={exporting === "PDF"} onClick={() => void handleExport("PDF")}>PDF</Button>
      </div>

      <div className="border-t pt-2">
        {comparisons.length === 0 ? (
          <Button variant="ghost" size="sm" loading={comparing} onClick={handleCompare}>Comparer avec les autres sessions de l'événement</Button>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--ap-paper-2)" }}>
                  <th className="px-2 py-1.5 text-left text-xs font-bold">Session</th>
                  <th className="px-2 py-1.5 text-left text-xs font-bold">Participants</th>
                  <th className="px-2 py-1.5 text-left text-xs font-bold">Questions</th>
                  <th className="px-2 py-1.5 text-left text-xs font-bold">Votes</th>
                  <th className="px-2 py-1.5 text-left text-xs font-bold">Interactions</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => (
                  <tr key={c.run.id} style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", fontWeight: c.run.id === run.id ? 700 : 400 }}>
                    <td className="px-2 py-1.5">{new Date(c.run.started_at).toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-1.5">{c.participantsCount}</td>
                    <td className="px-2 py-1.5">{c.questionsCount}</td>
                    <td className="px-2 py-1.5">{c.votesCount}</td>
                    <td className="px-2 py-1.5">{c.interactionsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** LIVE-015: "mode présentateur, écran public, appareil participant et
 *  console modérateur sont des vues distinctes" — the public screen
 *  (LivePresenterScreen.tsx) and participant device (LiveEventRoom.tsx)
 *  were already separate pages; only the two staff-facing roles
 *  (présentateur: drive the active interaction; modérateur: triage Q&A)
 *  were still merged into one console showing both at once. Split into a
 *  tab toggle here rather than two routes — same page, same run state
 *  already loaded, genuinely distinct views the animateur switches
 *  between rather than a permanently-merged panel. A "Rapport" tab
 *  (LIVE-020/021/022/023) joins them, reusing the same run already
 *  loaded. */
type ConsoleTab = "present" | "moderate" | "report";

function EventRow({ event, onActivate }: { event: LiveEvent; onActivate: (id: string) => void }) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("present");

  useEffect(() => {
    listLatestRun(event.id).then((r) => setRun(r && r.status === "open" ? r : null)).catch(() => setRun(null));
  }, [event.id]);

  const handleStartRun = async () => {
    setStarting(true);
    try {
      const newRun = await createLiveRun(event.id);
      setRun(newRun);
    } catch (err) {
      showError(err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{event.title} <span className="text-muted-foreground text-sm">· {event.code}</span></p>
          <p className="text-sm text-muted-foreground">{event.status}</p>
        </div>
        <div className="flex items-center gap-2">
          {event.status === "draft" && (
            <Button variant="ghost" size="sm" onClick={() => onActivate(event.id)}>Activer</Button>
          )}
          {event.status === "active" && !run && (
            <Button variant="ghost" size="sm" loading={starting} onClick={handleStartRun}>Démarrer un run</Button>
          )}
        </div>
      </div>
      {event.access_policy === "allowlist" && <AllowlistManager eventId={event.id} />}
      <ModerationSettingsPanel eventId={event.id} />
      {run && (
        <div className="mt-2 border-t pt-2 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio size={14} /> Run en cours depuis {new Date(run.started_at).toLocaleTimeString("fr-FR")}
            </div>
            <div className="flex items-center gap-2">
              <JoinLinkBadge code={event.code} />
              <a
                href={`/live/${event.code}/present`}
                target="_blank"
                rel="noreferrer"
                className="ap-btn ap-btn--ghost ap-btn--sm"
              >
                <MonitorPlay size={14} /> Écran projeté
              </a>
            </div>
          </div>
          <RunControls run={run} onLockChange={(locked) => setRun((prev) => (prev ? { ...prev, locked } : prev))} />
          <div className="flex items-center gap-1 border-b">
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={consoleTab === "present" ? { fontWeight: 700, borderBottom: "2px solid var(--ap-ink)" } : undefined}
              onClick={() => setConsoleTab("present")}
            >
              Présentateur
            </button>
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={consoleTab === "moderate" ? { fontWeight: 700, borderBottom: "2px solid var(--ap-ink)" } : undefined}
              onClick={() => setConsoleTab("moderate")}
            >
              Modération
            </button>
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={consoleTab === "report" ? { fontWeight: 700, borderBottom: "2px solid var(--ap-ink)" } : undefined}
              onClick={() => setConsoleTab("report")}
            >
              Rapport
            </button>
          </div>
          {consoleTab === "present" && <InteractionManager run={run} />}
          {consoleTab === "moderate" && <QuestionModeration run={run} />}
          {consoleTab === "report" && <SessionReportPanel event={event} run={run} />}
        </div>
      )}
    </li>
  );
}

export default function LmsLiveEngagement() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [title, setTitle] = useState("");
  const [accessPolicy, setAccessPolicy] = useState<LiveEvent["access_policy"]>("anonymous");
  const [creating, setCreating] = useState(false);
  useSEO({ title: "Sondage live & Q&A", description: "Animation, modération et coanimation en direct." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    listOrgLiveEvents(activeOrgId).then(setEvents).catch(showError).finally(() => setEventsLoading(false));
  }, [activeOrgId]);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !title.trim()) return;
    setCreating(true);
    try {
      const event = await createLiveEvent(activeOrgId, title.trim(), accessPolicy);
      setEvents((prev) => [event, ...prev]);
      setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateLiveEvent(id);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "active" } : e)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) {
    return (
      <AppLayout subtitle="Sondage live & Q&A">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isStaff || !activeOrgId) {
    return (
      <AppLayout subtitle="Sondage live & Q&A">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Cette vue est réservée aux animateurs (formateur/responsable/admin).</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Sondage live & Q&A">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Sondage live, Q&A et coanimation"
          description="Un événement regroupe plusieurs runs ; réutiliser un événement crée un nouveau run sans écraser l'historique."
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Événements</h2><p>Chaque run journalise sa propre Q&A et ses votes, dédupliqués par participant.</p></div>
          </div>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
            <div className="min-w-[220px] space-y-1">
              <label className="text-sm font-medium" htmlFor="event-title">Titre</label>
              <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="event-access-policy">Accès (LIVE-002)</label>
              <select
                id="event-access-policy"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={accessPolicy}
                onChange={(e) => setAccessPolicy(e.target.value as LiveEvent["access_policy"])}
              >
                <option value="anonymous">Anonyme</option>
                <option value="pseudonym">Pseudonyme</option>
                <option value="authenticated">Authentifié</option>
                <option value="allowlist">Sur liste</option>
              </select>
            </div>
            <Button type="submit" size="sm" loading={creating}><Plus /> Créer</Button>
          </form>

          {eventsLoading ? <TableSkeleton rows={2} cols={2} /> : events.length === 0 ? (
            <ExplorerEmptyState icon={<MessageCircleQuestion size={27} />} title="Aucun événement" body="Créez un événement, activez-le puis démarrez un run pour collecter les questions." />
          ) : (
            <ul className="space-y-2" aria-label="Événements live">
              {events.map((event) => <EventRow key={event.id} event={event} onActivate={handleActivate} />)}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
