import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth";
import { useSEO } from "@/hooks/useSEO";

type CalendarView = "month" | "week" | "day";
type EventKind = "quiz" | "course" | "exam" | "meeting";
type PlanningEvent = { id: string; title: string; start: string; end: string; kind: EventKind };

const KIND_META: Record<EventKind, { label: string; icon: string; className: string }> = {
  quiz: { label: "Quiz", icon: "quiz", className: "is-quiz" },
  course: { label: "Cours", icon: "school", className: "is-course" },
  exam: { label: "Examen", icon: "assignment_turned_in", className: "is-exam" },
  meeting: { label: "Réunion", icon: "groups", className: "is-meeting" },
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
  const storageKey = `planning-events-${user?.id ?? "anonymous"}`;
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(() => isoLocal(new Date()));
  const [end, setEnd] = useState(() => isoLocal(new Date(Date.now() + 60 * 60_000)));
  const [kind, setKind] = useState<EventKind>("quiz");
  const [events, setEvents] = useState<PlanningEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as PlanningEvent[]; }
    catch { return []; }
  });

  useSEO({ title: "Planning", description: "Planifiez vos cours, quiz, examens et réunions.", path: "/planning" });

  const persist = (next: PlanningEvent[]) => { setEvents(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const openCreate = (date = cursor) => {
    const from = new Date(date); from.setHours(9, 0, 0, 0);
    const to = new Date(from.getTime() + 60 * 60_000);
    setEditingId(null); setTitle(""); setKind("quiz"); setStart(isoLocal(from)); setEnd(isoLocal(to)); setDialogOpen(true);
  };
  const openEdit = (event: PlanningEvent) => {
    setEditingId(event.id); setTitle(event.title); setStart(event.start); setEnd(event.end); setKind(event.kind); setDialogOpen(true);
  };
  const save = () => {
    if (!title.trim() || !start || !end) return;
    const entry = { id: editingId ?? crypto.randomUUID(), title: title.trim(), start, end, kind };
    persist(editingId ? events.map((event) => event.id === editingId ? entry : event) : [...events, entry]);
    setDialogOpen(false);
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

  const EventPill = ({ event }: { event: PlanningEvent }) => (
    <button type="button" className={`planning-event ${KIND_META[event.kind].className}`} onClick={(click) => { click.stopPropagation(); openEdit(event); }}>
      <MaterialSymbol name={KIND_META[event.kind].icon} size={14} />
      <span>{new Date(event.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {event.title}</span>
    </button>
  );

  return (
    <AppLayout subtitle="Planning">
      <div className="product-page planning-page">
        <PageHeader title="Planning" description="Organisez les temps forts de votre espace pédagogique." action={<Button onClick={() => openCreate()}><MaterialSymbol name="add" size={18} /> Ajouter un événement</Button>} />
        <section className="ap-card planning-shell">
          <header className="planning-toolbar">
            <div className="planning-toolbar__nav">
              <button type="button" className="ap-icon-btn" aria-label="Période précédente" onClick={() => move(-1)}><MaterialSymbol name="chevron_left" size={19} /></button>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setCursor(new Date())}>Aujourd’hui</button>
              <button type="button" className="ap-icon-btn" aria-label="Période suivante" onClick={() => move(1)}><MaterialSymbol name="chevron_right" size={19} /></button>
            </div>
            <h2>{label}</h2>
            <div className="planning-view-switch" aria-label="Vue du planning">
              {(["month", "week", "day"] as const).map((item) => <button type="button" key={item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}>{item === "month" ? "Mois" : item === "week" ? "Semaine" : "Jour"}</button>)}
            </div>
          </header>

          {view === "month" ? (
            <div className="planning-month">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <div className="planning-weekday" key={day}>{day}</div>)}
              {monthDays.map((date) => (
                <button type="button" className={`planning-day${date.getMonth() !== cursor.getMonth() ? " is-outside" : ""}${sameDay(new Date().toISOString(), date) ? " is-today" : ""}`} key={dayKey(date)} onClick={() => openCreate(date)}>
                  <span className="planning-day__number">{date.getDate()}</span>
                  <span className="planning-day__events">{events.filter((event) => sameDay(event.start, date)).slice(0, 3).map((event) => <EventPill key={event.id} event={event} />)}{events.filter((event) => sameDay(event.start, date)).length > 3 && <small>+ {events.filter((event) => sameDay(event.start, date)).length - 3} autre(s)</small>}</span>
                </button>
              ))}
            </div>
          ) : view === "week" ? (
            <div className="planning-agenda planning-agenda--week">{weekDays.map((date) => <section key={dayKey(date)}><button type="button" className="planning-agenda__day-add" onClick={() => openCreate(date)}><strong>{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}</strong><span>{date.getDate()}</span></button><div>{events.filter((event) => sameDay(event.start, date)).map((event) => <EventPill key={event.id} event={event} />)}</div></section>)}</div>
          ) : (
            <div className="planning-day-view">{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => <div className="planning-hour" key={hour}><time>{String(hour).padStart(2, "0")}:00</time><div>{events.filter((event) => sameDay(event.start, cursor) && new Date(event.start).getHours() === hour).map((event) => <EventPill key={event.id} event={event} />)}</div></div>)}</div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Modifier l’événement" : "Nouvel événement"}</DialogTitle><DialogDescription>Ajoutez un temps fort à votre planning Brivia.</DialogDescription></DialogHeader>
          <div className="planning-event-form">
            <div><Label htmlFor="event-title">Titre</Label><Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Quiz de fin de module" /></div>
            <div><Label>Type</Label><Select value={kind} onValueChange={(value) => setKind(value as EventKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_META).map(([value, meta]) => <SelectItem value={value} key={value}>{meta.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="planning-event-form__dates"><div><Label htmlFor="event-start">Début</Label><Input id="event-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label htmlFor="event-end">Fin</Label><Input id="event-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></div></div>
          </div>
          <DialogFooter>{editingId && <Button variant="destructive" onClick={() => { persist(events.filter((event) => event.id !== editingId)); setDialogOpen(false); }}>Supprimer</Button>}<Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={save} disabled={!title.trim() || !start || !end}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
