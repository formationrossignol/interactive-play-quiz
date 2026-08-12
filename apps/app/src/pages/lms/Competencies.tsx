import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Link2, ListChecks, MessageSquareWarning, Plus, Target, Trash2, UserCog, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { PersonPicker } from "@/components/sharing/PersonPicker";
import { listGroupMembers, listGroups, usernamesByIds, type Group, type GroupMember, type UsernameMatch } from "@/lib/sharing/sharingRepo";
import {
  addCompetency,
  addScaleLevel,
  createFramework,
  createCompetencyAlignment,
  createMasteryScale,
  deleteCompetencyAlignment,
  listCompetencyAlignments,
  listCompetencyEvidence,
  listFrameworkCompetencies,
  listMasteryForLearners,
  listOrgFrameworks,
  listOrgMasteryScales,
  listOrgReviewRequests,
  listScaleLevels,
  myMastery,
  myReviewRequests,
  publishFramework,
  requestCompetencyReview,
  resolveReviewRequest,
  setManualMasteryLevel,
  updateMasteryScaleMethod,
  type AggregationMethod,
  type AlignmentTargetType,
  type Competency,
  type CompetencyAlignment,
  type CompetencyEvidenceRow,
  type CompetencyFramework,
  type CompetencyMastery,
  type CompetencyReviewRequest,
  type MasteryScale,
  type MasteryScaleLevel,
} from "@/lib/lms/competencies";
import { getRubricCriteria, listOrgAssignments, listOrgRubrics, type Assignment, type Rubric, type RubricCriterion } from "@/lib/lms/gradebook";

const AGGREGATION_METHOD_LABEL: Record<AggregationMethod, string> = {
  latest: "Dernière preuve", best: "Meilleure preuve", weighted_average: "Moyenne pondérée",
  recent_n: "N preuves récentes", manual: "Validation manuelle",
};

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

/** CMP-006/007. One scale per org (the default one) drives
 *  recompute_competency_mastery() for every competency in that org — there
 *  is no per-competency scale selection yet (recompute always reads the
 *  org's is_default=true row), so this manages that single scale rather
 *  than pretending a per-framework or per-competency picker exists. */
function MasteryScaleManager({ orgId }: { orgId: string }) {
  const [scale, setScale] = useState<MasteryScale | null>(null);
  const [levels, setLevels] = useState<MasteryScaleLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTitle, setCreatingTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [method, setMethod] = useState<AggregationMethod>("latest");
  const [recentN, setRecentN] = useState("3");
  const [savingMethod, setSavingMethod] = useState(false);
  const [levelCode, setLevelCode] = useState("");
  const [levelLabelInput, setLevelLabelInput] = useState("");
  const [levelPosition, setLevelPosition] = useState("0");
  const [levelMinScore, setLevelMinScore] = useState("0");
  const [addingLevel, setAddingLevel] = useState(false);

  const load = () => {
    setLoading(true);
    listOrgMasteryScales(orgId)
      .then(async (scales) => {
        const active = scales.find((s) => s.is_default) ?? scales[0] ?? null;
        setScale(active);
        if (active) {
          setMethod(active.aggregation_method);
          setRecentN(String(active.recent_n));
          setLevels(await listScaleLevels(active.id));
        }
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingTitle.trim()) return;
    setCreating(true);
    try {
      await createMasteryScale(orgId, creatingTitle.trim(), true);
      setCreatingTitle("");
      load();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveMethod = async () => {
    if (!scale) return;
    setSavingMethod(true);
    try {
      await updateMasteryScaleMethod(scale.id, method, Number(recentN) || 3);
      toast.success("Méthode d'agrégation mise à jour");
      load();
    } catch (err) {
      showError(err);
    } finally {
      setSavingMethod(false);
    }
  };

  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scale || !levelCode.trim() || !levelLabelInput.trim()) return;
    setAddingLevel(true);
    try {
      const level = await addScaleLevel({
        scaleId: scale.id, code: levelCode.trim(), label: levelLabelInput.trim(),
        position: Number(levelPosition) || 0, minScore: Number(levelMinScore) || 0,
      });
      setLevels((prev) => [...prev, level].sort((a, b) => a.position - b.position));
      setLevelCode(""); setLevelLabelInput(""); setLevelPosition(""); setLevelMinScore("");
    } catch (err) {
      showError(err);
    } finally {
      setAddingLevel(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Échelle de maîtrise</h2><p>Niveaux et méthode d'agrégation appliqués à toutes les compétences de l'organisation.</p></div>
      </div>

      {!scale ? (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] space-y-1">
            <label className="text-sm font-medium" htmlFor="scale-title">Titre de l'échelle par défaut</label>
            <Input id="scale-title" value={creatingTitle} onChange={(e) => setCreatingTitle(e.target.value)} placeholder="Ex. Échelle standard" required />
          </div>
          <Button type="submit" loading={creating}><Plus /> Créer</Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] space-y-1">
              <label className="text-xs font-medium" htmlFor="agg-method">Méthode d'agrégation</label>
              <select id="agg-method" className={inputClass} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value as AggregationMethod)}>
                {Object.entries(AGGREGATION_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {method === "recent_n" && (
              <div className="w-24 space-y-1">
                <label className="text-xs font-medium" htmlFor="agg-recent-n">N</label>
                <input id="agg-recent-n" className={inputClass} style={inputStyle} inputMode="numeric" value={recentN} onChange={(e) => setRecentN(e.target.value)} />
              </div>
            )}
            <Button size="sm" loading={savingMethod} onClick={() => void handleSaveMethod()}><ListChecks size={14} /> Enregistrer</Button>
          </div>

          {levels.length > 0 && (
            <ul className="space-y-1">
              {levels.map((l) => (
                <li key={l.id} className="text-sm rounded border px-3 py-1.5 flex items-center justify-between">
                  <span className="font-mono text-muted-foreground mr-2">{l.code}</span>
                  <span>{l.label} <span className="text-muted-foreground">· position {l.position} · seuil {l.min_score}</span></span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddLevel} className="flex flex-wrap items-end gap-2">
            <div className="w-28 space-y-1">
              <label className="text-xs font-medium" htmlFor="level-code">Code</label>
              <Input id="level-code" value={levelCode} onChange={(e) => setLevelCode(e.target.value)} placeholder="mastered" required />
            </div>
            <div className="min-w-[160px] space-y-1">
              <label className="text-xs font-medium" htmlFor="level-label">Libellé</label>
              <Input id="level-label" value={levelLabelInput} onChange={(e) => setLevelLabelInput(e.target.value)} placeholder="Maîtrisé" required />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs font-medium" htmlFor="level-position">Position</label>
              <Input id="level-position" inputMode="numeric" value={levelPosition} onChange={(e) => setLevelPosition(e.target.value)} required />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs font-medium" htmlFor="level-min-score">Seuil</label>
              <Input id="level-min-score" inputMode="decimal" value={levelMinScore} onChange={(e) => setLevelMinScore(e.target.value)} required />
            </div>
            <Button size="sm" type="submit" loading={addingLevel}><Plus size={14} /> Ajouter un niveau</Button>
          </form>
        </div>
      )}
    </section>
  );
}

/** Only meaningful while the org's default scale is in 'manual' mode —
 *  the RPC re-checks this server-side regardless (fail closed). */
function SetMasteryLevelPanel({ orgId, competency }: { orgId: string; competency: Competency }) {
  const [scale, setScale] = useState<MasteryScale | null>(null);
  const [levels, setLevels] = useState<MasteryScaleLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [learner, setLearner] = useState<UsernameMatch | null>(null);
  const [levelCode, setLevelCode] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listOrgMasteryScales(orgId)
      .then(async (scales) => {
        const active = scales.find((s) => s.is_default) ?? scales[0] ?? null;
        setScale(active);
        if (active) setLevels(await listScaleLevels(active.id));
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learner || !levelCode || !reason.trim()) return;
    setSaving(true);
    try {
      await setManualMasteryLevel(competency.id, learner.id, levelCode, reason.trim());
      toast.success(`Niveau fixé pour @${learner.username}`);
      setLearner(null); setLevelCode(""); setReason("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!scale || scale.aggregation_method !== "manual") return null;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <p className="text-xs text-muted-foreground">Échelle « {scale.title} » en validation manuelle — fixer un niveau pour un apprenant.</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] space-y-1">
          <span className="text-xs font-medium block">Apprenant</span>
          {learner ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">@{learner.username}</span>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setLearner(null)}>Changer</button>
            </div>
          ) : (
            <PersonPicker
              onPickUsername={(match) => setLearner(match)}
              onInviteEmail={() => toast.error("Fixer un niveau exige un compte existant sur la plateforme.")}
            />
          )}
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`manual-level-${competency.id}`}>Niveau</label>
          <select id={`manual-level-${competency.id}`} className={inputClass} style={inputStyle} value={levelCode} onChange={(e) => setLevelCode(e.target.value)} required>
            <option value="" disabled>Choisir…</option>
            {levels.map((l) => <option key={l.id} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium" htmlFor={`manual-reason-${competency.id}`}>Motif</label>
          <Input id={`manual-reason-${competency.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        <Button size="sm" type="submit" loading={saving} disabled={!learner}><UserCog size={14} /> Fixer le niveau</Button>
      </form>
    </div>
  );
}

const STAFF_ROLES = new Set(["pedago", "admin"]);
const TRAINER_ROLES = new Set(["trainer", "pedago", "admin"]);

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
              {aligningId === c.id && (
                <>
                  <AlignmentManager orgId={orgId} competency={c} />
                  <SetMasteryLevelPanel orgId={orgId} competency={c} />
                </>
              )}
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

const REVIEW_STATUS_LABEL: Record<CompetencyReviewRequest["status"], string> = {
  open: "En attente", resolved: "Résolue", dismissed: "Rejetée",
};

function LearnerMastery() {
  const [mastery, setMastery] = useState<CompetencyMastery[]>([]);
  const [requests, setRequests] = useState<CompetencyReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([myMastery(), myReviewRequests()])
      .then(([m, r]) => { setMastery(m); setRequests(r); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, []);

  const requestsByCompetency = useMemo(() => {
    const map = new Map<string, CompetencyReviewRequest[]>();
    for (const r of requests) map.set(r.competency_id, [...(map.get(r.competency_id) ?? []), r]);
    return map;
  }, [requests]);

  const handleRequest = async (m: CompetencyMastery) => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const request = await requestCompetencyReview(m.org_id, m.competency_id, m.learner_id, message.trim());
      setRequests((prev) => [request, ...prev]);
      setMessage("");
      setRequestingId(null);
      toast.success("Demande de revue envoyée");
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

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
        <div><h2>Mes compétences</h2><p>Niveau actuel et dernière mise à jour. Vous pouvez demander une revue, jamais la modifier vous-même.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Mes compétences">
        {mastery.map((m) => {
          const compRequests = requestsByCompetency.get(m.competency_id) ?? [];
          const hasOpenRequest = compRequests.some((r) => r.status === "open");
          return (
            <li key={m.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Compétence {m.competency_id.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{levelLabel[m.level_code] ?? m.level_code}</span>
                  <Button
                    variant="ghost" size="sm" disabled={hasOpenRequest}
                    onClick={() => setRequestingId((cur) => (cur === m.id ? null : m.id))}
                  >
                    <MessageSquareWarning size={14} /> {hasOpenRequest ? "Revue en attente" : "Demander une revue"}
                  </Button>
                </div>
              </div>
              {compRequests.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {compRequests.map((r) => (
                    <li key={r.id} className="text-xs text-muted-foreground">
                      {REVIEW_STATUS_LABEL[r.status]} — {r.message}
                    </li>
                  ))}
                </ul>
              )}
              {requestingId === m.id && (
                <form onSubmit={(e) => { e.preventDefault(); void handleRequest(m); }} className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1 space-y-1">
                    <label className="text-xs font-medium" htmlFor={`review-msg-${m.id}`}>Message</label>
                    <Input id={`review-msg-${m.id}`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pourquoi demandez-vous une revue ?" required />
                  </div>
                  <Button size="sm" type="submit" loading={submitting}>Envoyer</Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewRequestsPanel({ orgId }: { orgId: string }) {
  const [requests, setRequests] = useState<CompetencyReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listOrgReviewRequests(orgId).then(setRequests).catch(showError).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolve = async (id: string, status: "resolved" | "dismissed") => {
    setActingId(id);
    try {
      await resolveReviewRequest(id, status);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, resolved_at: new Date().toISOString() } : r)));
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  const open = requests.filter((r) => r.status === "open");

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Demandes de revue</h2><p>CMP-018 : l'apprenant peut demander une revue, jamais modifier lui-même son niveau.</p></div>
      </div>
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
      ) : (
        <ul className="space-y-2" aria-label="Demandes de revue en attente">
          {open.map((r) => (
            <li key={r.id} className="rounded-md border p-3">
              <p className="text-sm">Compétence {r.competency_id.slice(0, 8)} · apprenant {r.learner_id.slice(0, 8)}</p>
              <p className="text-sm text-muted-foreground mt-1">{r.message}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" size="sm" loading={actingId === r.id} onClick={() => void handleResolve(r.id, "resolved")}>
                  <CheckCircle2 size={14} /> Marquer résolue
                </Button>
                <Button variant="ghost" size="sm" loading={actingId === r.id} onClick={() => void handleResolve(r.id, "dismissed")}>
                  <XCircle size={14} /> Rejeter
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** CMP-020 "vue formateur : groupe × compétences, filtres, écarts et accès
 *  aux preuves autorisées." Group = the trainer's own share_groups (same
 *  personal-group model already used for assignment/content targeting
 *  elsewhere in this codebase — not an org-wide roster grouping). All
 *  reads (`competency_mastery`/`competency_evidence` staff policies
 *  already cover trainer) — no migration. */
function TrainerGroupMatrix({ orgId }: { orgId: string }) {
  const user = getCurrentUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [frameworks, setFrameworks] = useState<CompetencyFramework[]>([]);
  const [levels, setLevels] = useState<MasteryScaleLevel[]>([]);
  const [groupId, setGroupId] = useState("");
  const [frameworkId, setFrameworkId] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [mastery, setMastery] = useState<CompetencyMastery[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [evidenceCell, setEvidenceCell] = useState<{ learnerId: string; competencyId: string } | null>(null);
  const [evidence, setEvidence] = useState<CompetencyEvidenceRow[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => {
    if (!user) { setLoadingLists(false); return; }
    Promise.all([listGroups(user.id), listOrgFrameworks(orgId), listOrgMasteryScales(orgId)])
      .then(async ([g, f, scales]) => {
        setGroups(g);
        setFrameworks(f.filter((fw) => fw.status === "published"));
        const active = scales.find((s) => s.is_default) ?? scales[0] ?? null;
        if (active) setLevels(await listScaleLevels(active.id));
      })
      .catch(showError)
      .finally(() => setLoadingLists(false));
  }, [orgId, user]);

  useEffect(() => {
    if (!groupId || !frameworkId) { setMembers([]); setCompetencies([]); setMastery([]); return; }
    setLoadingMatrix(true);
    setEvidenceCell(null);
    Promise.all([listGroupMembers(groupId), listFrameworkCompetencies(frameworkId)])
      .then(async ([m, comps]) => {
        const realMembers = m.filter((x): x is GroupMember & { user_id: string } => x.user_id !== null);
        setMembers(realMembers);
        setCompetencies(comps);
        const [resolvedNames, masteryRows] = await Promise.all([
          usernamesByIds(realMembers.map((x) => x.user_id)),
          listMasteryForLearners(comps.map((c) => c.id), realMembers.map((x) => x.user_id)),
        ]);
        setNames(new Map(resolvedNames.map((n) => [n.id, n.username])));
        setMastery(masteryRows);
      })
      .catch(showError)
      .finally(() => setLoadingMatrix(false));
  }, [groupId, frameworkId]);

  const masteryByPair = useMemo(() => {
    const map = new Map<string, CompetencyMastery>();
    for (const m of mastery) map.set(`${m.learner_id}:${m.competency_id}`, m);
    return map;
  }, [mastery]);
  const positionByCode = useMemo(() => new Map(levels.map((l) => [l.code, l.position])), [levels]);
  const targetPosition = targetLevel ? positionByCode.get(targetLevel) : undefined;

  const openEvidence = async (learnerId: string, competencyId: string) => {
    setEvidenceCell({ learnerId, competencyId });
    setEvidenceLoading(true);
    try {
      setEvidence(await listCompetencyEvidence(competencyId, learnerId));
    } catch (err) {
      showError(err);
    } finally {
      setEvidenceLoading(false);
    }
  };

  if (loadingLists) return <TableSkeleton rows={2} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Vue formateur — groupe × compétences</h2><p>Écarts par rapport à un seuil attendu, accès aux preuves d'un apprenant.</p></div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="min-w-[180px] space-y-1">
          <label className="text-xs font-medium" htmlFor="matrix-group">Groupe</label>
          <select id="matrix-group" className={inputClass} style={inputStyle} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Choisir…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="min-w-[180px] space-y-1">
          <label className="text-xs font-medium" htmlFor="matrix-framework">Référentiel publié</label>
          <select id="matrix-framework" className={inputClass} style={inputStyle} value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)}>
            <option value="">Choisir…</option>
            {frameworks.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </div>
        {levels.length > 0 && (
          <div className="min-w-[160px] space-y-1">
            <label className="text-xs font-medium" htmlFor="matrix-target">Seuil attendu (écarts)</label>
            <select id="matrix-target" className={inputClass} style={inputStyle} value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)}>
              <option value="">Aucun</option>
              {levels.map((l) => <option key={l.id} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun groupe. Créez-en un depuis le partage de contenu pour l'utiliser ici.</p>
      ) : !groupId || !frameworkId ? (
        <p className="text-sm text-muted-foreground">Choisissez un groupe et un référentiel publié.</p>
      ) : loadingMatrix ? (
        <TableSkeleton rows={3} cols={3} />
      ) : members.length === 0 || competencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Groupe vide ou référentiel sans compétence.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: "var(--ap-paper-2)" }}>
                <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Apprenant</th>
                {competencies.map((c) => (
                  <th key={c.id} className="border-b px-2 py-1.5 text-left text-xs font-bold font-mono" style={{ borderColor: "var(--ap-line)" }}>{c.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                  <td className="px-2 py-1.5">@{names.get(m.user_id) ?? "apprenant"}</td>
                  {competencies.map((c) => {
                    const cell = masteryByPair.get(`${m.user_id}:${c.id}`);
                    const level = cell?.level_code ?? "not_assessed";
                    const pos = positionByCode.get(level);
                    const isGap = targetPosition !== undefined && (pos === undefined || pos < targetPosition);
                    return (
                      <td key={c.id} className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          style={{ color: isGap ? "var(--ap-danger)" : undefined }}
                          onClick={() => void openEvidence(m.user_id, c.id)}
                        >
                          {levelLabel[level] ?? level}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {evidenceCell && (
        <div className="mt-4 rounded-md border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Preuves — @{names.get(evidenceCell.learnerId) ?? "apprenant"}</p>
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setEvidenceCell(null)}>Fermer</button>
          </div>
          {evidenceLoading ? <TableSkeleton rows={2} cols={2} /> : evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune preuve.</p>
          ) : (
            <ul className="space-y-1">
              {evidence.map((e) => (
                <li key={e.id} className="text-xs rounded border px-2 py-1.5">
                  {new Date(e.occurred_at).toLocaleDateString("fr-FR")} · {e.source_type}
                  {e.level_code ? ` · ${levelLabel[e.level_code] ?? e.level_code}` : ""}
                  {e.raw_score !== null ? ` · ${e.raw_score}` : ""}
                  {e.voided_at ? " · annulée" : ""}
                  {e.comment && <span className="block text-muted-foreground mt-0.5">{e.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
  const isTrainer = useMemo(
    () => memberships.some((m) => m.org_id === activeOrgId && TRAINER_ROLES.has(m.role)),
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
        {isTrainer && activeOrgId ? (
          <div className="space-y-4">
            {isStaff && <MasteryScaleManager orgId={activeOrgId} />}
            {isStaff && <StaffFrameworks orgId={activeOrgId} />}
            <TrainerGroupMatrix orgId={activeOrgId} />
            {isStaff && <ReviewRequestsPanel orgId={activeOrgId} />}
          </div>
        ) : <LearnerMastery />}
      </div>
    </AppLayout>
  );
}
