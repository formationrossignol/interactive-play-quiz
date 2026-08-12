import { useEffect, useMemo, useState } from "react";
import { CalendarRange, CheckCircle2, Plus, Upload, Users, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import { listContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { EnrollmentImportDialog } from "@/components/lms/EnrollmentImportDialog";
import { SessionRosterPanel } from "@/components/lms/SessionRosterPanel";
import {
  acceptWaitlistOffer,
  createCourseSession,
  declineWaitlistOffer,
  ensureCourseOffering,
  listOrgSessions,
  myEnrollments,
  myWaitlistEntries,
  publishSession,
  type CourseSession,
  type Enrollment,
  type EnrollmentStatus,
  type WaitlistEntry,
} from "@/lib/lms/enrollment";

const STAFF_ROLES = new Set(["registrar", "pedago", "admin"]);

const sessionStatusLabel: Record<CourseSession["status"], string> = {
  draft: "Brouillon",
  published: "Publiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const enrollmentStatusLabel: Record<EnrollmentStatus, string> = {
  invited: "Invité",
  pending: "En attente",
  waitlisted: "Liste d'attente",
  active: "En cours",
  completed: "Terminée",
  failed: "Échouée",
  withdrawn: "Retirée",
  cancelled: "Annulée",
  expired: "Expirée",
};

function StaffSessions({ orgId }: { orgId: string }) {
  const user = getCurrentUser();
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [courses, setCourses] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState("");
  const [courseId, setCourseId] = useState("");
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);
  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);

  const reload = () => {
    listOrgSessions(orgId).then(setSessions).catch(showError).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    reload();
    listContent(user.id, "course").then(setCourses).catch(() => setCourses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !label.trim() || !code.trim()) return;
    setCreating(true);
    try {
      const offering = await ensureCourseOffering(orgId, courseId);
      const course = courses.find((c) => c.id === courseId);
      const session = await createCourseSession({
        orgId,
        offeringId: offering.id,
        label: label.trim(),
        code: code.trim(),
        capacity: capacity ? Number(capacity) : null,
        contentSnapshot: (course?.data as Record<string, unknown>) ?? {},
        contentHash: String(course?.updated_at ?? Date.now()),
      });
      setSessions((prev) => [session, ...prev]);
      setFormOpen(false);
      setLabel(""); setCode(""); setCapacity(""); setCourseId("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (sessionId: string) => {
    try {
      await publishSession(sessionId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status: "published" } : s)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={4} cols={5} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Sessions</h2><p>Planifiez une occurrence d'un cours et suivez ses inscrits.</p></div>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
          <Plus /> Nouvelle session
        </Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="min-w-[200px] space-y-1">
            <label className="text-sm font-medium" htmlFor="session-course">Cours</label>
            <select
              id="session-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="" disabled>Choisir un cours…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{(c.data as { title?: string })?.title ?? c.id}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] space-y-1">
            <label className="text-sm font-medium" htmlFor="session-label">Libellé</label>
            <Input id="session-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="min-w-[120px] space-y-1">
            <label className="text-sm font-medium" htmlFor="session-code">Code</label>
            <Input id="session-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="min-w-[100px] space-y-1">
            <label className="text-sm font-medium" htmlFor="session-capacity">Capacité</label>
            <Input id="session-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <Button type="submit" loading={creating}>Créer</Button>
        </form>
      )}

      {sessions.length === 0 ? (
        <ExplorerEmptyState
          icon={<CalendarRange size={27} />}
          title="Aucune session planifiée"
          body="Créez une session à partir d'un cours publié pour commencer à inscrire des apprenants."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Créer une session</Button>}
        />
      ) : (
        <ul className="space-y-2" aria-label="Sessions de l'organisation">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.label} <span className="text-muted-foreground text-sm">({s.code})</span></p>
                  <p className="text-sm text-muted-foreground">
                    {sessionStatusLabel[s.status]} · {s.capacity ? `${s.capacity} places` : "capacité illimitée"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setRosterSessionId((cur) => (cur === s.id ? null : s.id))}>
                    <Users size={14} /> Effectif
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setImportingSessionId(s.id)}>
                    <Upload size={14} /> Importer
                  </Button>
                  {s.status === "draft" && (
                    <Button variant="ghost" size="sm" onClick={() => handlePublish(s.id)}>Publier</Button>
                  )}
                </div>
              </div>
              {rosterSessionId === s.id && (
                <SessionRosterPanel session={s} otherSessions={sessions.filter((other) => other.id !== s.id)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {importingSessionId && (
        <EnrollmentImportDialog
          open={Boolean(importingSessionId)}
          onOpenChange={(next) => { if (!next) setImportingSessionId(null); }}
          orgId={orgId}
          sessionId={importingSessionId}
          onImported={reload}
        />
      )}
    </section>
  );
}

function timeLeftLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expire à l'instant";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} h restantes`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min restantes`;
}

/** ENR-011/012's UI half — the RPC pair already atomically turns an
 *  'offered' entry into an active enrollment (or re-chains
 *  promote_waitlist() to the next learner on decline); this just surfaces
 *  the offer and its 48h window. */
function WaitlistOffers({ entries, onResolved }: { entries: WaitlistEntry[]; onResolved: () => void }) {
  const [actingId, setActingId] = useState<string | null>(null);

  const offered = entries.filter((e) => e.status === "offered" && e.expires_at && new Date(e.expires_at) > new Date());
  if (offered.length === 0) return null;

  const handleAccept = async (entry: WaitlistEntry) => {
    setActingId(entry.id);
    try {
      await acceptWaitlistOffer(entry.id);
      onResolved();
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };
  const handleDecline = async (entry: WaitlistEntry) => {
    setActingId(entry.id);
    try {
      await declineWaitlistOffer(entry.id);
      onResolved();
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="product-list-panel p-5 mb-4" style={{ borderColor: "var(--ap-brand-soft, #6d5efc)" }}>
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Une place s'est libérée</h2><p>Répondez avant l'expiration — sinon elle est offerte au suivant sur liste d'attente.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Offres de liste d'attente">
        {offered.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Session {entry.session_id.slice(0, 8)}</p>
              <p className="text-sm text-muted-foreground">{timeLeftLabel(entry.expires_at!)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" loading={actingId === entry.id} onClick={() => handleDecline(entry)}>
                <XCircle size={14} /> Refuser
              </Button>
              <Button size="sm" loading={actingId === entry.id} onClick={() => handleAccept(entry)}>
                <CheckCircle2 size={14} /> Accepter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LearnerEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    Promise.all([myEnrollments(), myWaitlistEntries()])
      .then(([e, w]) => { setEnrollments(e); setWaitlistEntries(w); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const groups = useMemo(() => {
    const upcoming = enrollments.filter((e) => e.status === "invited" || e.status === "pending" || e.status === "waitlisted");
    const active = enrollments.filter((e) => e.status === "active");
    const done = enrollments.filter((e) => ["completed", "failed", "withdrawn", "cancelled", "expired"].includes(e.status));
    return { upcoming, active, done };
  }, [enrollments]);

  if (loading) return <ListLoading />;

  if (enrollments.length === 0) {
    return (
      <>
        <WaitlistOffers entries={waitlistEntries} onResolved={reload} />
        <ExplorerEmptyState
          icon={<Users size={27} />}
          title="Aucune formation en cours"
          body="Vos inscriptions à des sessions apparaîtront ici, classées par statut."
        />
      </>
    );
  }

  const renderGroup = (title: string, rows: Enrollment[]) => (
    rows.length === 0 ? null : (
      <div className="mb-4">
        <h3 className="ap-h3" style={{ fontSize: 15, marginBottom: 8 }}>{title}</h3>
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Session {e.session_id.slice(0, 8)}</span>
              <span className="text-sm font-medium">{enrollmentStatusLabel[e.status]}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  );

  return (
    <>
      <WaitlistOffers entries={waitlistEntries} onResolved={reload} />
      <section className="product-list-panel p-5">
        <div className="product-panel-heading -mx-5 -mt-5 mb-4">
          <div><h2>Mes formations</h2><p>À venir, en cours et terminées.</p></div>
        </div>
        {renderGroup("À venir", groups.upcoming)}
        {renderGroup("En cours", groups.active)}
        {renderGroup("Terminées", groups.done)}
      </section>
    </>
  );
}

function ListLoading() {
  return <TableSkeleton rows={3} cols={2} />;
}

export default function LmsSessions() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Sessions & inscriptions", description: "Planifiez des sessions et suivez les inscriptions de votre organisation." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout subtitle="Sessions & inscriptions">
        <PageSkeleton />
      </AppLayout>
    );
  }

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  return (
    <AppLayout subtitle="Sessions & inscriptions">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Sessions & inscriptions"
          description="Le cycle d'inscription aux cours et sessions de votre organisation."
        />
        {isStaff && activeOrgId ? <StaffSessions orgId={activeOrgId} /> : <LearnerEnrollments />}
      </div>
    </AppLayout>
  );
}
