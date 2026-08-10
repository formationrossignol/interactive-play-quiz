import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FilePlus2, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  addAssignmentTarget,
  createAssignment,
  listAssignmentSubmissions,
  listOrgAssignments,
  listMyAssignments,
  mySubmission,
  publishAssignment,
  publishSubmissionGrade,
  submitAssignment,
  type Assignment,
  type Submission,
} from "@/lib/lms/gradebook";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);

function GradingPanel({ assignment }: { assignment: Assignment }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    listAssignmentSubmissions(assignment.id).then(setSubmissions).catch(showError).finally(() => setLoading(false));
  }, [assignment.id]);

  const handlePublish = async (submissionId: string) => {
    const raw = scores[submissionId];
    const score = Number(raw);
    if (!raw || Number.isNaN(score)) return;
    setSaving(submissionId);
    try {
      await publishSubmissionGrade({ submissionId, score });
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? { ...s, status: "graded" } : s)));
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={3} />;
  if (submissions.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune remise pour l'instant.</p>;
  }

  return (
    <ul className="space-y-2">
      {submissions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Apprenant {s.learner_id.slice(0, 8)}</p>
            <p className="text-sm text-muted-foreground">{s.status}</p>
          </div>
          {s.status !== "graded" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={assignment.max_points}
                className="w-20"
                value={scores[s.id] ?? ""}
                onChange={(e) => setScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                aria-label={`Note sur ${assignment.max_points}`}
              />
              <Button size="sm" loading={saving === s.id} onClick={() => handlePublish(s.id)}>Publier</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function StaffAssignments({ orgId }: { orgId: string }) {
  const user = getCurrentUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxPoints, setMaxPoints] = useState("20");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listOrgAssignments(orgId).then(setAssignments).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const assignment = await createAssignment({
        orgId,
        ownerId: user.id,
        title: title.trim(),
        responseMode: "text",
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxPoints: Number(maxPoints) || 20,
      });
      // Fondations scope: target the whole org's org-role "learner" pool is
      // out of reach without a session — target every active session in one
      // click is a later UX pass. For now the trainer wires targets manually
      // (e.g. by session) once created, matching ASG-004's per-target model.
      setAssignments((prev) => [assignment, ...prev]);
      setFormOpen(false);
      setTitle(""); setDueAt(""); setMaxPoints("20");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleTargetSessionAndPublish = async (assignmentId: string, sessionId: string) => {
    try {
      await addAssignmentTarget(assignmentId, "session", sessionId);
      await publishAssignment(assignmentId);
      setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, status: "published" } : a)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={4} cols={4} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Devoirs</h2><p>Créez un devoir, corrigez les remises et publiez les résultats.</p></div>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
          <Plus /> Nouveau devoir
        </Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="min-w-[220px] space-y-1">
            <label className="text-sm font-medium" htmlFor="assignment-title">Titre</label>
            <Input id="assignment-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="assignment-due">Échéance</label>
            <Input id="assignment-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="w-24 space-y-1">
            <label className="text-sm font-medium" htmlFor="assignment-points">Barème</label>
            <Input id="assignment-points" type="number" min={1} value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
          </div>
          <Button type="submit" loading={creating}>Créer le brouillon</Button>
        </form>
      )}

      {assignments.length === 0 ? (
        <ExplorerEmptyState
          icon={<FilePlus2 size={27} />}
          title="Aucun devoir créé"
          body="Rédigez la consigne, le barème et l'échéance, puis affectez-le à une session pour le publier."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Créer un devoir</Button>}
        />
      ) : (
        <ul className="space-y-2" aria-label="Devoirs">
          {assignments.map((a) => (
            <li key={a.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.status === "published" ? "Publié" : "Brouillon"} · {a.max_points} pts
                    {a.due_at ? ` · échéance ${new Date(a.due_at).toLocaleString("fr-FR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "draft" && a.session_id && (
                    <Button variant="ghost" size="sm" onClick={() => handleTargetSessionAndPublish(a.id, a.session_id!)}>
                      Publier à la session
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === a.id ? null : a.id))}>
                    {expanded === a.id ? "Fermer" : "Corriger"}
                  </Button>
                </div>
              </div>
              {expanded === a.id && (
                <div className="mt-3 border-t pt-3">
                  <GradingPanel assignment={a} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LearnerAssignmentRow({ assignment }: { assignment: Assignment }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mySubmission(assignment.id).then(setSubmission).catch(() => setSubmission(null)).finally(() => setLoading(false));
  }, [assignment.id]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const result = await submitAssignment({ assignmentId: assignment.id, kind: "text", textContent: text.trim(), finalize: true });
      setSubmission(result);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySubmitted = submission && submission.status !== "draft";

  return (
    <li className="rounded-md border p-3 space-y-2">
      <div>
        <p className="font-medium">{assignment.title}</p>
        <p className="text-sm text-muted-foreground">
          {assignment.due_at ? `Échéance : ${new Date(assignment.due_at).toLocaleString("fr-FR")}` : "Sans échéance"}
          {alreadySubmitted ? ` · ${submission!.status}` : ""}
        </p>
      </div>
      {!loading && !alreadySubmitted && (
        <div className="flex flex-wrap items-end gap-2">
          <Textarea
            className="min-w-[260px] flex-1"
            placeholder="Votre réponse…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button size="sm" loading={submitting} onClick={handleSubmit}>Remettre</Button>
        </div>
      )}
    </li>
  );
}

function LearnerAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyAssignments().then(setAssignments).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  if (assignments.length === 0) {
    return (
      <ExplorerEmptyState
        icon={<ClipboardCheck size={27} />}
        title="Aucun devoir à rendre"
        body="Les devoirs publiés pour vos sessions apparaîtront ici avec leur échéance."
      />
    );
  }

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Mes devoirs</h2><p>Consultez l'échéance et remettez votre travail.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Devoirs à rendre">
        {assignments.map((a) => <LearnerAssignmentRow key={a.id} assignment={a} />)}
      </ul>
    </section>
  );
}

export default function LmsAssignments() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Devoirs & gradebook", description: "Devoirs, remises et carnet de notes unifié." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = useMemo(
    () => memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role)),
    [memberships, activeOrgId],
  );

  if (loading) {
    return (
      <AppLayout subtitle="Devoirs & gradebook">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Devoirs & gradebook">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Devoirs & gradebook"
          description="Workflow de remise, correction par rubrique et carnet de notes unifié."
        />
        {isStaff && activeOrgId ? <StaffAssignments orgId={activeOrgId} /> : <LearnerAssignments />}
      </div>
    </AppLayout>
  );
}
