import { useEffect, useMemo, useState } from "react";
import { Award, Link2, Plus, Target, Trash2 } from "lucide-react";
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
  addCompetency,
  createFramework,
  createCompetencyAlignment,
  deleteCompetencyAlignment,
  listCompetencyAlignments,
  listFrameworkCompetencies,
  listOrgFrameworks,
  myMastery,
  publishFramework,
  type AlignmentTargetType,
  type Competency,
  type CompetencyAlignment,
  type CompetencyFramework,
  type CompetencyMastery,
} from "@/lib/lms/competencies";
import { getRubricCriteria, listOrgAssignments, listOrgRubrics, type Assignment, type Rubric, type RubricCriterion } from "@/lib/lms/gradebook";

const inputClass = "h-9 w-full rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const EVIDENCE_ROLE_LABEL: Record<CompetencyAlignment["evidence_role"], string> = {
  teaching: "Enseignement", practice: "Pratique", assessment: "Évaluation",
};

function AlignmentManager({ orgId, competency }: { orgId: string; competency: Competency }) {
  const [alignments, setAlignments] = useState<CompetencyAlignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [criteriaByRubric, setCriteriaByRubric] = useState<Map<string, RubricCriterion[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState<AlignmentTargetType>("assignment");
  const [assignmentId, setAssignmentId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [weight, setWeight] = useState("1");
  const [evidenceRole, setEvidenceRole] = useState<CompetencyAlignment["evidence_role"]>("assessment");
  const [isRequired, setIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listCompetencyAlignments(competency.id),
      listOrgAssignments(orgId),
      listOrgRubrics(orgId),
    ])
      .then(([a, as, r]) => { setAlignments(a); setAssignments(as); setRubrics(r); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [competency.id, orgId]);

  useEffect(() => {
    if (!rubricId || criteriaByRubric.has(rubricId)) return;
    getRubricCriteria(rubricId).then((criteria) => {
      setCriteriaByRubric((prev) => new Map(prev).set(rubricId, criteria));
    }).catch(showError);
  }, [rubricId, criteriaByRubric]);

  const assignmentById = useMemo(() => new Map(assignments.map((a) => [a.id, a.title])), [assignments]);
  const criterionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const criteria of criteriaByRubric.values()) {
      for (const c of criteria) map.set(c.id, c.label);
    }
    return map;
  }, [criteriaByRubric]);

  const targetLabel = (alignment: CompetencyAlignment): string => {
    if (alignment.target_type === "assignment") return assignmentById.get(alignment.target_id) ?? "Devoir";
    if (alignment.target_type === "rubric_criterion") return criterionLabel.get(alignment.target_id) ?? "Critère";
    return alignment.target_type;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = targetType === "assignment" ? assignmentId : criterionId;
    if (!targetId) return;
    setSaving(true);
    try {
      const alignment = await createCompetencyAlignment({
        competencyId: competency.id, targetType, targetId,
        weight: Number(weight.replace(",", ".")) || 1,
        evidenceRole, isRequired,
      });
      setAlignments((prev) => [alignment, ...prev]);
      setAssignmentId(""); setRubricId(""); setCriterionId(""); setWeight("1"); setIsRequired(false);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCompetencyAlignment(id);
      setAlignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        Alignements sur devoir ou critère de rubrique. Cours/module/leçon/question/examen/SCORM/H5P/étape de parcours : pas encore de sélecteur ici.
      </p>

      {alignments.length > 0 && (
        <ul className="space-y-1">
          {alignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
              <span>
                {targetLabel(a)} <span className="text-muted-foreground">· {EVIDENCE_ROLE_LABEL[a.evidence_role]} · coef. {a.weight}{a.is_required ? " · obligatoire" : ""}</span>
              </span>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer l'alignement" onClick={() => void handleDelete(a.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`target-type-${competency.id}`}>Cible</label>
          <select id={`target-type-${competency.id}`} className={inputClass} style={inputStyle} value={targetType} onChange={(e) => setTargetType(e.target.value as AlignmentTargetType)}>
            <option value="assignment">Devoir</option>
            <option value="rubric_criterion">Critère de rubrique</option>
          </select>
        </div>
        {targetType === "assignment" ? (
          <div className="min-w-[200px] space-y-1">
            <label className="text-xs font-medium" htmlFor={`assignment-${competency.id}`}>Devoir</label>
            <select id={`assignment-${competency.id}`} className={inputClass} style={inputStyle} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} required>
              <option value="" disabled>Choisir…</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-medium" htmlFor={`rubric-${competency.id}`}>Grille</label>
              <select id={`rubric-${competency.id}`} className={inputClass} style={inputStyle} value={rubricId} onChange={(e) => { setRubricId(e.target.value); setCriterionId(""); }} required>
                <option value="" disabled>Choisir…</option>
                {rubrics.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-medium" htmlFor={`criterion-${competency.id}`}>Critère</label>
              <select id={`criterion-${competency.id}`} className={inputClass} style={inputStyle} value={criterionId} onChange={(e) => setCriterionId(e.target.value)} required disabled={!rubricId}>
                <option value="" disabled>Choisir…</option>
                {(criteriaByRubric.get(rubricId) ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="w-20 space-y-1">
          <label className="text-xs font-medium" htmlFor={`weight-${competency.id}`}>Coef.</label>
          <input id={`weight-${competency.id}`} className={inputClass} style={inputStyle} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="min-w-[140px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`role-${competency.id}`}>Rôle</label>
          <select id={`role-${competency.id}`} className={inputClass} style={inputStyle} value={evidenceRole} onChange={(e) => setEvidenceRole(e.target.value as CompetencyAlignment["evidence_role"])}>
            {Object.entries(EVIDENCE_ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs pb-2">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Obligatoire
        </label>
        <Button size="sm" type="submit" loading={saving}><Link2 size={14} /> Aligner</Button>
      </form>
    </div>
  );
}

const STAFF_ROLES = new Set(["pedago", "admin"]);

const levelLabel: Record<string, string> = {
  not_assessed: "Non évalué",
  beginner: "Débutant",
  in_progress: "En acquisition",
  mastered: "Maîtrisé",
  expert: "Expert",
};

function FrameworkCompetencies({ orgId, framework }: { orgId: string; framework: CompetencyFramework }) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [aligningId, setAligningId] = useState<string | null>(null);

  useEffect(() => {
    listFrameworkCompetencies(framework.id).then(setCompetencies).catch(showError).finally(() => setLoading(false));
  }, [framework.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;
    setAdding(true);
    try {
      const competency = await addCompetency(framework.id, code.trim(), title.trim());
      setCompetencies((prev) => [...prev, competency]);
      setCode(""); setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="w-24 space-y-1">
          <label className="text-sm font-medium" htmlFor={`code-${framework.id}`}>Code</label>
          <Input id={`code-${framework.id}`} value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={`title-${framework.id}`}>Titre</label>
          <Input id={`title-${framework.id}`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Button size="sm" type="submit" loading={adding}><Plus /> Ajouter</Button>
      </form>
      {competencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune compétence dans ce référentiel.</p>
      ) : (
        <ul className="space-y-1">
          {competencies.map((c) => (
            <li key={c.id} className="text-sm rounded border px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground mr-2">{c.code}</span>
                <Button variant="ghost" size="sm" onClick={() => setAligningId((cur) => (cur === c.id ? null : c.id))}>
                  <Link2 size={14} /> {aligningId === c.id ? "Fermer" : "Aligner"}
                </Button>
              </div>
              {aligningId === c.id && <AlignmentManager orgId={orgId} competency={c} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffFrameworks({ orgId }: { orgId: string }) {
  const [frameworks, setFrameworks] = useState<CompetencyFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listOrgFrameworks(orgId).then(setFrameworks).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const framework = await createFramework(orgId, title.trim());
      setFrameworks((prev) => [framework, ...prev]);
      setFormOpen(false);
      setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishFramework(id);
      setFrameworks((prev) => prev.map((f) => (f.id === id ? { ...f, status: "published" } : f)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={3} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Référentiels de compétences</h2><p>Définissez la structure, publiez et alignez vos contenus.</p></div>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}><Plus /> Nouveau référentiel</Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="min-w-[220px] space-y-1">
            <label className="text-sm font-medium" htmlFor="framework-title">Titre</label>
            <Input id="framework-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <Button type="submit" loading={creating}>Créer</Button>
        </form>
      )}

      {frameworks.length === 0 ? (
        <ExplorerEmptyState
          icon={<Target size={27} />}
          title="Aucun référentiel"
          body="Créez un référentiel, ajoutez des compétences puis publiez-le pour l'aligner sur vos contenus."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Créer un référentiel</Button>}
        />
      ) : (
        <ul className="space-y-2" aria-label="Référentiels">
          {frameworks.map((f) => (
            <li key={f.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.status === "published" ? "Publié" : "Brouillon"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {f.status === "draft" && (
                    <Button variant="ghost" size="sm" onClick={() => handlePublish(f.id)}>Publier</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === f.id ? null : f.id))}>
                    {expanded === f.id ? "Fermer" : "Compétences"}
                  </Button>
                </div>
              </div>
              {expanded === f.id && <FrameworkCompetencies orgId={orgId} framework={f} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LearnerMastery() {
  const [mastery, setMastery] = useState<CompetencyMastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myMastery().then(setMastery).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  if (mastery.length === 0) {
    return (
      <ExplorerEmptyState
        icon={<Award size={27} />}
        title="Aucune compétence évaluée"
        body="Vos niveaux de maîtrise apparaîtront ici au fil de vos activités notées."
      />
    );
  }

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Mes compétences</h2><p>Niveau actuel et dernière mise à jour.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Mes compétences">
        {mastery.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Compétence {m.competency_id.slice(0, 8)}</span>
            <span className="text-sm font-medium">{levelLabel[m.level_code] ?? m.level_code}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LmsCompetencies() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Compétences", description: "Référentiels, alignements, preuves et maîtrise." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = useMemo(
    () => memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role)),
    [memberships, activeOrgId],
  );

  if (loading) {
    return (
      <AppLayout subtitle="Compétences">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Compétences">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Compétences et résultats d'apprentissage"
          description="Référentiels gouvernés, preuves traçables et maîtrise explicable."
        />
        {isStaff && activeOrgId ? <StaffFrameworks orgId={activeOrgId} /> : <LearnerMastery />}
      </div>
    </AppLayout>
  );
}
