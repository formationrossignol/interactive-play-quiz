import { useEffect, useState } from "react";
import { BarChart3, Check, Copy, Lock, MessageCircleQuestion, MonitorPlay, Plus, Radio, Square, Trash2, UserX, Unlock, Users } from "lucide-react";
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
  closeLiveInteraction,
  createLiveEvent,
  createLiveRun,
  createPollInteraction,
  kickParticipant,
  listInteractionResponses,
  listOrgLiveEvents,
  listLatestRun,
  listRunInteractions,
  listRunParticipants,
  listRunQuestions,
  moderateQuestion,
  openLiveInteraction,
  setRunLocked,
  type AudienceQuestion,
  type LiveEvent,
  type LiveInteraction,
  type LiveParticipantRow,
  type LiveRun,
  type PollConfig,
} from "@/lib/lms/liveEngagement";

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
          for (const optionId of row.payload.optionIds ?? []) {
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

function CreatePollForm({ runId, onCreated }: { runId: string; onCreated: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const updateOption = (index: number, value: string) => setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (index: number) => setOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) return;
    setCreating(true);
    try {
      const config: PollConfig = {
        question: question.trim(),
        options: cleanOptions.map((label, i) => ({ id: `opt-${i}-${Date.now()}`, label })),
        allowMultiple,
      };
      await createPollInteraction(runId, config);
      setQuestion(""); setOptions(["", ""]); setAllowMultiple(false); setOpen(false);
      onCreated();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (!open) {
    return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Créer un sondage</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-3 space-y-2">
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" required />
      {options.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={value} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
          {options.length > 2 && (
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer" onClick={() => removeOption(i)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={addOption}><Plus size={14} /> Option</Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} /> Plusieurs réponses autorisées
        </label>
      </div>
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

  const polls = interactions.filter((i) => i.kind === "poll");

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 size={14} /> Sondages</p>
      </div>
      {loading ? <TableSkeleton rows={1} cols={1} /> : (
        <div className="space-y-2">
          {polls.map((interaction) => {
            const config = interaction.config as PollConfig;
            return (
              <div key={interaction.id} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="text-left text-sm flex-1" onClick={() => setExpandedId((cur) => (cur === interaction.id ? null : interaction.id))}>
                    {config.question} <span className="text-muted-foreground">· {interaction.status}</span>
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
                {expandedId === interaction.id && <PollResults interaction={interaction} />}
              </div>
            );
          })}
          <CreatePollForm runId={run.id} onCreated={reload} />
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

function EventRow({ event, onActivate }: { event: LiveEvent; onActivate: (id: string) => void }) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [starting, setStarting] = useState(false);

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
          <QuestionModeration run={run} />
          <InteractionManager run={run} />
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
      const event = await createLiveEvent(activeOrgId, title.trim());
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
