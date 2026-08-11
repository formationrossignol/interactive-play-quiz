import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeletons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { listMyAssignments } from "@/lib/lms/gradebook";
import {
  createPlanningEvent,
  deletePlanningEvent,
  listMyPlanningEvents,
  updatePlanningEvent,
  type PlanningEvent as StoredPlanningEvent,
  type PlanningEventKind,
} from "@/lib/planningRepo";

type CalendarView = "month" | "week" | "day";
type EventKind = PlanningEventKind | "assignment";
/** `source: "manual"` events are the user's own planning_events rows,
 *  editable/deletable here. `source: "assignment"` entries are read-only —
 *  merged in from real due dates so the calendar reflects actual devoirs
 *  instead of requiring them to be re-entered by hand; clicking one opens
 *  the assignment itself rather than the edit dialog. */
type PlanningItem =
  | { source: "manual"; id: string; title: string; start: string; end: string; kind: PlanningEventKind }
  | { source: "assignment"; id: string; title: string; start: string; end: string };

const KIND_META: Record<EventKind, { label: string; icon: string; className: string }> = {
  quiz: { label: "Quiz", icon: "quiz", className: "is-quiz" },
  course: { label: "Cours", icon: "school", className: "is-course" },
  exam: { label: "Examen", icon: "assignment_turned_in", className: "is-exam" },
  meeting: { label: "Réunion", icon: "groups", className: "is-meeting" },
  assignment: { label: "Devoir", icon: "edit_note", className: "is-course" },
};

const isoLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sameDay = (iso: string, date: Date) => dayKey(new Date(iso)) === dayKey(date);
const mondayOf = (date: Date) => {
  const value = new Date(date);
  const weekday = value.getDay() || 7;
  value.setDate(value.getDate() - weekday + 1);
  value.setHours(0, 0, 0, 0);
  return value;
};

export default function PlanningPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(() => isoLocal(new Date()));
  const [end, setEnd] = useState(() => isoLocal(new Date(Date.now() + 60 * 60_000)));
  const [kind, setKind] = useState<PlanningEventKind>("quiz");
  const [saving, setSaving] = useState(false);
  const [manualEvents, setManualEvents] = useState<StoredPlanningEvent[]>([]);
  const [assignmentItems, setAssignmentItems] = useState<PlanningItem[]>([]);

  useSEO({ title: "Planning", description: "Planifiez vos cours, quiz, examens et réunions.", path: "/planning" });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([listMyPlanningEvents(), listMyAssignments()])
      .then(([planningEvents, assignments]) => {
        setManualEvents(planningEvents);
        setAssignmentItems(
          assignments
            .filter((a) => a.due_at)
            .map((a) => ({ source: "assignment" as const, id: a.id, title: a.title, start: a.due_at!, end: a.due_at! })),
        );
      })
      .catch((err) => showError(err, "PlanningPage.load", "Impossible de charger le planning."))
      .finally(() => setLoading(false));
  }, [user]);

  const items: PlanningItem[] = useMemo(() => [
    ...manualEvents.map((e): PlanningItem => ({ source: "manual", id: e.id, title: e.title, start: e.starts_at, end: e.ends_at, kind: e.kind })),
    ...assignmentItems,
  ], [manualEvents, assignmentItems]);

  const openCreate = (date = cursor) => {
    const from = new Date(date); from.setHours(9, 0, 0, 0);
    const to = new Date(from.getTime() + 60 * 60_000);
    setEditingId(null); setTitle(""); setKind("quiz"); setStart(isoLocal(from)); setEnd(isoLocal(to)); setDialogOpen(true);
  };
  const openItem = (item: PlanningItem) => {
    if (item.source === "assignment") { navigate("/lms/assignments"); return; }
    setEditingId(item.id); setTitle(item.title); setStart(item.start); setEnd(item.end); setKind(item.kind); setDialogOpen(true);
  };
  const save = async () => {
    if (!title.trim() || !start || !end) return;
    setSaving(true);
    try {
      const input = { title: title.trim(), kind, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
      if (editingId) {
        const updated = await updatePlanningEvent(editingId, input);
        setManualEvents((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
      } else {
        const created = await createPlanningEvent(input);
        setManualEvents((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await deletePlanningEvent(editingId);
      setManualEvents((prev) => prev.filter((e) => e.id !== editingId));
      setDialogOpen(false);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };
  const move = (direction: number) => setCursor((current) => {
    const next = new Date(current);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else if (view === "week") next.setDate(next.getDate() + direction * 7);
    else next.setDate(next.getDate() + direction);
    return next;
  });
  const label = view === "month"
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(cursor)
    : view === "week"
      ? `Semaine du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(mondayOf(cursor))}`
      : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(cursor);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const firstMonday = mondayOf(first);
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(firstMonday); date.setDate(date.getDate() + index); return date; });
  }, [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = mondayOf(cursor); date.setDate(date.getDate() + index); return date; }), [cursor]);

  if (!user) return <Navigate to="/auth" replace />;

  if (loading) {
    return (
      <AppLayout subtitle="Planning">
        <PageSkeleton />
      </AppLayout>
    );
  }

  const kindOf = (item: PlanningItem): EventKind => (item.source === "assignment" ? "assignment" : item.kind);

  const EventPill = ({ item }: { item: PlanningItem }) => (
    <button type="button" className={`planning-event ${KIND_META[kindOf(item)].className}`} onClick={(click) => { click.stopPropagation(); openItem(item); }}>
      <MaterialSymbol name={KIND_META[kindOf(item)].icon} size={14} />
      <span>{new Date(item.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {item.title}</span>
    </button>
  );

  return (
    <AppLayout subtitle="Planning">
      <div className="product-page planning-page">
        <PageHeader title="Planning" description="Organisez les temps forts de votre espace pédagogique — vos devoirs à échéance apparaissent automatiquement." action={<Button onClick={() => openCreate()}><MaterialSymbol name="add" size={18} /> Ajouter un événement</Button>} />
        <section className="ap-card planning-shell">
          <header className="planning-toolbar">
            <div className="planning-toolbar__nav">
              <button type="button" className="ap-icon-btn" aria-label="Période précédente" onClick={() => move(-1)}><MaterialSymbol name="chevron_left" size={19} /></button>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setCursor(new Date())}>Aujourd’hui</button>
              <button type="button" className="ap-icon-btn" aria-label="Période suivante" onClick={() => move(1)}><MaterialSymbol name="chevron_right" size={19} /></button>
            </div>
            <h2>{label}</h2>
            <div className="planning-view-switch" aria-label="Vue du planning">
              {(["month", "week", "day"] as const).map((v) => <button type="button" key={v} className={view === v ? "is-active" : ""} onClick={() => setView(v)}>{v === "month" ? "Mois" : v === "week" ? "Semaine" : "Jour"}</button>)}
            </div>
          </header>

          {view === "month" ? (
            <div className="planning-month">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <div className="planning-weekday" key={day}>{day}</div>)}
              {monthDays.map((date) => (
                <button type="button" className={`planning-day${date.getMonth() !== cursor.getMonth() ? " is-outside" : ""}${sameDay(new Date().toISOString(), date) ? " is-today" : ""}`} key={dayKey(date)} onClick={() => openCreate(date)}>
                  <span className="planning-day__number">{date.getDate()}</span>
                  <span className="planning-day__events">{items.filter((item) => sameDay(item.start, date)).slice(0, 3).map((item) => <EventPill key={`${item.source}-${item.id}`} item={item} />)}{items.filter((item) => sameDay(item.start, date)).length > 3 && <small>+ {items.filter((item) => sameDay(item.start, date)).length - 3} autre(s)</small>}</span>
                </button>
              ))}
            </div>
          ) : view === "week" ? (
            <div className="planning-agenda planning-agenda--week">{weekDays.map((date) => <section key={dayKey(date)}><button type="button" className="planning-agenda__day-add" onClick={() => openCreate(date)}><strong>{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}</strong><span>{date.getDate()}</span></button><div>{items.filter((item) => sameDay(item.start, date)).map((item) => <EventPill key={`${item.source}-${item.id}`} item={item} />)}</div></section>)}</div>
          ) : (
            <div className="planning-day-view">{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => <div className="planning-hour" key={hour}><time>{String(hour).padStart(2, "0")}:00</time><div>{items.filter((item) => sameDay(item.start, cursor) && new Date(item.start).getHours() === hour).map((item) => <EventPill key={`${item.source}-${item.id}`} item={item} />)}</div></div>)}</div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Modifier l’événement" : "Nouvel événement"}</DialogTitle><DialogDescription>Ajoutez un temps fort à votre planning Brivia.</DialogDescription></DialogHeader>
          <div className="planning-event-form">
            <div><Label htmlFor="event-title">Titre</Label><Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Quiz de fin de module" /></div>
            <div><Label>Type</Label><Select value={kind} onValueChange={(value) => setKind(value as PlanningEventKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["quiz", "course", "exam", "meeting"] as const).map((value) => <SelectItem value={value} key={value}>{KIND_META[value].label}</SelectItem>)}</SelectContent></Select></div>
            <div className="planning-event-form__dates"><div><Label htmlFor="event-start">Début</Label><Input id="event-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label htmlFor="event-end">Fin</Label><Input id="event-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></div></div>
          </div>
          <DialogFooter>{editingId && <Button variant="destructive" loading={saving} onClick={remove}>Supprimer</Button>}<Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button loading={saving} onClick={save} disabled={!title.trim() || !start || !end}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
