import { useEffect, useState } from "react";
import { Check, Copy, Lock, MessageCircleQuestion, Plus, Radio, UserX, Unlock, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  activateLiveEvent,
  createLiveEvent,
  createLiveRun,
  kickParticipant,
  listOrgLiveEvents,
  listLatestRun,
  listRunParticipants,
  listRunQuestions,
  moderateQuestion,
  setRunLocked,
  type AudienceQuestion,
  type LiveEvent,
  type LiveParticipantRow,
  type LiveRun,
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
            <JoinLinkBadge code={event.code} />
          </div>
          <RunControls run={run} onLockChange={(locked) => setRun((prev) => (prev ? { ...prev, locked } : prev))} />
          <QuestionModeration run={run} />
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
