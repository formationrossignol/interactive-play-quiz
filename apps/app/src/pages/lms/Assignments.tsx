import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, FilePlus2, ListChecks, Plus, TableProperties } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton, TableSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  addAssignmentTarget,
  addRubricCriterion,
  addRubricLevel,
  createAssignment,
  createRubric,
  getRubricCriteria,
  listAssignmentSubmissions,
  listOrgAssignments,
  listOrgRubrics,
  listMyAssignments,
  myGradeResults,
  mySubmission,
  publishAssignment,
  publishSubmissionGrade,
  submitAssignment,
  type Assignment,
  type GradeItem,
  type GradeResult,
  type Rubric,
  type RubricCriterion,
  type RubricRating,
  type Submission,
} from "@/lib/lms/gradebook";
import { SOURCE_LABEL, simulateWhatIf } from "@/lib/lms/gradebookCalculations";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);

function CriterionEditor({ criterion, onLevelAdded }: { criterion: RubricCriterion; onLevelAdded: (criterionId: string, level: RubricCriterion["rubric_levels"][number]) => void }) {
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAddLevel = async () => {
    if (!label.trim()) return;
    setAdding(true);
    try {
      const level = await addRubricLevel(criterion.id, label.trim(), Number(points) || 0, criterion.rubric_levels.length);
      onLevelAdded(criterion.id, level);
      setLabel(""); setPoints("");
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <li className="rounded-md border p-3">
      <p className="font-medium text-sm">{criterion.label} <span className="text-muted-foreground">· {criterion.max_points} pts</span></p>
      {criterion.rubric_levels.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {criterion.rubric_levels.map((lvl) => (
            <li key={lvl.id} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{lvl.label} · {lvl.points} pts</li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2 mt-2">
        <Input placeholder="Niveau (ex. Excellent)" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
        <Input type="number" placeholder="Pts" value={points} onChange={(e) => setPoints(e.target.value)} className="w-20" />
        <Button size="sm" variant="ghost" loading={adding} onClick={handleAddLevel}>Ajouter</Button>
      </div>
    </li>
  );
}

function RubricBuilder({ rubric }: { rubric: Rubric }) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [maxPoints, setMaxPoints] = useState("5");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getRubricCriteria(rubric.id).then(setCriteria).catch(showError).finally(() => setLoading(false));
  }, [rubric.id]);

  const handleAddCriterion = async () => {
    if (!label.trim()) return;
    setAdding(true);
    try {
      const criterion = await addRubricCriterion(rubric.id, label.trim(), Number(maxPoints) || 0, criteria.length);
      setCriteria((prev) => [...prev, criterion]);
      setLabel(""); setMaxPoints("5");
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  const handleLevelAdded: React.ComponentProps<typeof CriterionEditor>["onLevelAdded"] = (criterionId, level) => {
    setCriteria((prev) => prev.map((c) => (c.id === criterionId ? { ...c, rubric_levels: [...c.rubric_levels, level] } : c)));
  };

  if (loading) return <ListSkeleton rows={2} withAvatar={false} />;

  return (
    <div className="mt-2 space-y-2">
      {criteria.length > 0 && (
        <ul className="space-y-2">
          {criteria.map((c) => <CriterionEditor key={c.id} criterion={c} onLevelAdded={handleLevelAdded} />)}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <Input placeholder="Critère (ex. Clarté)" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
        <Input type="number" placeholder="Max pts" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} className="w-24" />
        <Button size="sm" variant="ghost" loading={adding} onClick={handleAddCriterion}>Ajouter un critère</Button>
      </div>
    </div>
  );
}

function RubricManager({ orgId }: { orgId: string }) {
  const user = getCurrentUser();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listOrgRubrics(orgId).then(setRubrics).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const rubric = await createRubric(orgId, user.id, title.trim());
      setRubrics((prev) => [rubric, ...prev]);
      setTitle("");
      setExpanded(rubric.id);
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Grilles de correction</h2><p>Critères et niveaux réutilisables — sélectionnables au moment de corriger un devoir.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="rubric-title">Nom de la grille</label>
          <Input id="rubric-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Créer</Button>
      </form>
      {rubrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune grille pour l'instant.</p>
      ) : (
        <ul className="space-y-2" aria-label="Grilles de correction">
          {rubrics.map((r) => (
            <li key={r.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.title}</p>
                <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}>
                  {expanded === r.id ? "Fermer" : "Modifier"}
                </Button>
              </div>
              {expanded === r.id && <RubricBuilder rubric={r} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RubricGrading({ criteria, ratings, onChange }: {
  criteria: RubricCriterion[];
  ratings: Record<string, RubricRating>;
  onChange: (ratings: Record<string, RubricRating>) => void;
}) {
  const handlePick = (criterion: RubricCriterion, level: RubricCriterion["rubric_levels"][number]) => {
    onChange({ ...ratings, [criterion.id]: { criterion_id: criterion.id, level_id: level.id, points: level.points } });
  };

  return (
    <ul className="space-y-2">
      {criteria.map((c) => (
        <li key={c.id}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{c.label}</p>
          <div className="flex flex-wrap gap-1">
            {c.rubric_levels.map((lvl) => {
              const selected = ratings[c.id]?.level_id === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  style={selected ? { background: "var(--ap-accent, #6d5efc)", color: "white" } : undefined}
                  onClick={() => handlePick(c, lvl)}
                >
                  {lvl.label} · {lvl.points}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

function GradingPanel({ assignment, rubrics }: { assignment: Assignment; rubrics: Rubric[] }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [rubricId, setRubricId] = useState("");
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [ratingsBySubmission, setRatingsBySubmission] = useState<Record<string, Record<string, RubricRating>>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listAssignmentSubmissions(assignment.id).then(setSubmissions).catch(showError).finally(() => setLoading(false));
  }, [assignment.id]);

  useEffect(() => {
    if (!rubricId) { setCriteria([]); return; }
    getRubricCriteria(rubricId).then(setCriteria).catch(showError);
  }, [rubricId]);

  const handlePublish = async (submissionId: string) => {
    const ratings = ratingsBySubmission[submissionId];
    const ratingsList = ratings ? Object.values(ratings) : [];
    const rubricTotal = ratingsList.reduce((sum, r) => sum + r.points, 0);
    const raw = scores[submissionId];
    const score = raw ? Number(raw) : (ratingsList.length > 0 ? rubricTotal : NaN);
    if (Number.isNaN(score)) return;
    setSaving(submissionId);
    try {
      await publishSubmissionGrade({
        submissionId, score,
        rubricId: ratingsList.length > 0 ? rubricId : null,
        rubricRatings: ratingsList,
      });
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
    <div className="space-y-3">
      {rubrics.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={rubricId || "none"} onValueChange={(v) => setRubricId(v === "none" ? "" : v)}>
            <SelectTrigger className="w-[220px]" aria-label="Grille de correction"><SelectValue placeholder="Grille de correction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Note libre</SelectItem>
              {rubrics.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <ul className="space-y-2">
        {submissions.map((s) => {
          const ratings = ratingsBySubmission[s.id] ?? {};
          const rubricTotal = Object.values(ratings).reduce((sum, r) => sum + r.points, 0);
          return (
            <li key={s.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Apprenant {s.learner_id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">{s.status}</p>
                </div>
                {s.status !== "graded" && (
                  <div className="flex items-center gap-2">
                    {rubricId && criteria.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === s.id ? null : s.id))}>
                        <ListChecks size={14} /> Grille
                      </Button>
                    )}
                    <Input
                      type="number"
                      min={0}
                      max={assignment.max_points}
                      className="w-20"
                      placeholder={Object.keys(ratings).length > 0 ? String(rubricTotal) : undefined}
                      value={scores[s.id] ?? ""}
                      onChange={(e) => setScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      aria-label={`Note sur ${assignment.max_points}`}
                    />
                    <Button size="sm" loading={saving === s.id} onClick={() => handlePublish(s.id)}>Publier</Button>
                  </div>
                )}
              </div>
              {expanded === s.id && rubricId && criteria.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <RubricGrading
                    criteria={criteria}
                    ratings={ratings}
                    onChange={(next) => setRatingsBySubmission((prev) => ({ ...prev, [s.id]: next }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
  const [rubrics, setRubrics] = useState<Rubric[]>([]);

  useEffect(() => {
    listOrgAssignments(orgId).then(setAssignments).catch(showError).finally(() => setLoading(false));
    listOrgRubrics(orgId).then(setRubrics).catch(() => setRubrics([]));
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
    <div className="space-y-5">
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Devoirs</h2><p>Créez un devoir, corrigez les remises et publiez les résultats.</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/lms/gradebook"><TableProperties /> Gradebook</Link>
          </Button>
          <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus /> Nouveau devoir
          </Button>
        </div>
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
                  <GradingPanel assignment={a} rubrics={rubrics} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    <RubricManager orgId={orgId} />
    </div>
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

/** Builds the pseudo grade_items the simulator/totals need from the shape
 *  myGradeResults() actually returns (no separate grade_items fetch). */
function itemsFromResults(results: GradeResult[]): GradeItem[] {
  return results
    .filter((r) => r.grade_items)
    .map((r) => ({
      id: r.grade_item_id,
      org_id: '', session_id: null, source_id: '', created_at: '',
      source_type: (r.grade_items!.source_type as GradeItem['source_type']) ?? 'manual',
      title: r.grade_items!.title,
      category: r.grade_items!.category ?? 'general',
      weight: r.grade_items!.weight ?? 1,
      max_points: r.grade_items!.max_points,
    }));
}

/** GBK-005: client-only "what if I receive X" — never persisted, scoped to
 *  the items already tracked in myGradeResults() (a learner can't simulate
 *  an item that has never produced a grade_results row at all). */
function WhatIfSimulator({ results }: { results: GradeResult[] }) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const items = useMemo(() => itemsFromResults(results), [results]);
  const learnerId = results[0]?.learner_id ?? '';
  const baseByItemId = useMemo(() => new Map(results.map((r) => [r.grade_item_id, r])), [results]);

  const overrideMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const raw = overrides[item.id];
      if (raw === undefined || raw.trim() === '') continue;
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) map.set(item.id, (parsed / item.max_points) * 100);
    }
    return map;
  }, [overrides, items]);

  const totals = useMemo(
    () => simulateWhatIf(items, baseByItemId, learnerId, overrideMap, new Set()),
    [items, baseByItemId, learnerId, overrideMap],
  );

  if (items.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? 'Fermer la simulation' : 'Simuler « si je reçois X »'}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">Simulation locale, jamais enregistrée — modifiez une note pour voir l'effet sur le total.</p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{item.title}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={item.max_points}
                    className="w-20"
                    placeholder={String(baseByItemId.get(item.id)?.points ?? '')}
                    value={overrides[item.id] ?? ''}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    aria-label={`Note simulée pour ${item.title}`}
                  />
                  <span className="text-muted-foreground">/{item.max_points}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium">
            Total simulé : {totals.overall.percentage === null ? '—' : `${totals.overall.percentage.toFixed(1)}%`}
          </p>
        </div>
      )}
    </div>
  );
}

function MyGrades() {
  const [results, setResults] = useState<GradeResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myGradeResults().then(setResults).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <ListSkeleton rows={2} withAvatar={false} />;
  if (results.length === 0) return null;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Mes notes</h2><p>Devoirs, examens et évaluations manuelles réunis au même endroit.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Mes notes">
        {results.map((r) => (
          <li key={r.id} className="rounded-md border p-3 text-sm flex items-center justify-between">
            <div>
              <p className="font-medium">{r.grade_items?.title ?? 'Note'}</p>
              <p className="text-muted-foreground">{SOURCE_LABEL[r.grade_items?.source_type ?? ''] ?? r.grade_items?.source_type}</p>
            </div>
            <span className="font-medium">
              {r.status === 'excused' ? 'Dispensé' : r.points != null && r.grade_items ? `${r.points} / ${r.grade_items.max_points}` : '—'}
            </span>
          </li>
        ))}
      </ul>
      <WhatIfSimulator results={results} />
    </section>
  );
}

function LearnerAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyAssignments().then(setAssignments).catch(showError).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      {loading ? <TableSkeleton rows={3} cols={2} /> : assignments.length === 0 ? (
        <ExplorerEmptyState
          icon={<ClipboardCheck size={27} />}
          title="Aucun devoir à rendre"
          body="Les devoirs publiés pour vos sessions apparaîtront ici avec leur échéance."
        />
      ) : (
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Mes devoirs</h2><p>Consultez l'échéance et remettez votre travail.</p></div>
          </div>
          <ul className="space-y-2" aria-label="Devoirs à rendre">
            {assignments.map((a) => <LearnerAssignmentRow key={a.id} assignment={a} />)}
          </ul>
        </section>
      )}
      <MyGrades />
    </div>
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
