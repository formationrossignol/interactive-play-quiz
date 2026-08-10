import { useEffect, useState } from "react";
import { MessageCircleQuestion, Plus, Radio } from "lucide-react";
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
  listOrgLiveEvents,
  listLatestRun,
  listRunQuestions,
  moderateQuestion,
  type AudienceQuestion,
  type LiveEvent,
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

function EventRow({ event, onActivate }: { event: LiveEvent; onActivate: (id: string) => void }) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    listLatestRun(event.id).then(setRun).catch(() => setRun(null));
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
        <div className="mt-2 border-t pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio size={14} /> Run en cours depuis {new Date(run.started_at).toLocaleTimeString("fr-FR")}
          </div>
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
