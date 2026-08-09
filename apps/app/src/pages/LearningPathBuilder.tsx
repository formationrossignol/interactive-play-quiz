import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  GitBranch,
  Link2,
  Plus,
  Route,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonShimmerLabel } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCurrentUser } from "@/lib/auth";
import { genId, getUserCourses, type Course } from "@/lib/courseStorage";
import {
  createLearningPath,
  getLearningPathById,
  updateLearningPath,
  type LearningPathStep,
} from "@/lib/learningPathStorage";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 600,
  fontSize: 14,
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  outline: "none",
};

const fieldLabel = (label: string) => (
  <label className="ap-muted" style={{ display: "block", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>
    {label}
  </label>
);

const totalLessons = (course: Course) =>
  course.modules.reduce((total, module) => total + module.lessons.length, 0);

export default function LearningPathBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pathId = params.get("pathId");
  const user = getCurrentUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSequential, setIsSequential] = useState(true);
  const [steps, setSteps] = useState<LearningPathStep[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [saving, setSaving] = useState(false);

  const courses = useMemo(() => user ? getUserCourses(user.id) : [], [user]);
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const availableCourses = courses.filter((course) => !steps.some((step) => step.courseId === course.id));

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!pathId) return;
    const path = getLearningPathById(pathId);
    if (!path || path.userId !== user.id) {
      toast.error("Parcours introuvable");
      navigate("/my-learning-paths");
      return;
    }
    setTitle(path.title);
    setDescription(path.description);
    setIsSequential(path.isSequential);
    setSteps(path.steps);
  }, [navigate, pathId, user]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    if (steps.length === 0) {
      toast.error("Ajoutez au moins un cours au parcours");
      return;
    }

    setSaving(true);
    try {
      const data = { title, description, isSequential, steps };
      const saved = pathId ? updateLearningPath(pathId, data) : createLearningPath(data);
      if (!saved) throw new Error("Save failed");
      toast.success(pathId ? "Parcours enregistré" : "Parcours créé");
      if (!pathId) navigate(`/learning-path-builder?pathId=${saved.id}`, { replace: true });
    } catch {
      toast.error("Impossible d’enregistrer ce parcours");
    } finally {
      setSaving(false);
    }
  };

  useSaveShortcut(handleSave, !saving);

  const addCourse = () => {
    if (!selectedCourseId) return;
    setSteps((current) => [
      ...current,
      {
        id: genId(),
        courseId: selectedCourseId,
        prerequisiteStepIds: [],
        requiredCompletionPercentage: 100,
      },
    ]);
    setSelectedCourseId("");
  };

  const updateStep = (stepId: string, updates: Partial<LearningPathStep>) => {
    setSteps((current) => current.map((step) => step.id === stepId ? { ...step, ...updates } : step));
  };

  const removeStep = (stepId: string) => {
    setSteps((current) =>
      current
        .filter((step) => step.id !== stepId)
        .map((step) => ({
          ...step,
          prerequisiteStepIds: step.prerequisiteStepIds.filter((id) => id !== stepId),
        })),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const togglePrerequisite = (step: LearningPathStep, prerequisiteId: string, checked: boolean) => {
    updateStep(step.id, {
      prerequisiteStepIds: checked
        ? [...step.prerequisiteStepIds, prerequisiteId]
        : step.prerequisiteStepIds.filter((id) => id !== prerequisiteId),
    });
  };

  if (!user) return null;

  return (
    <AppLayout subtitle="Créateur de parcours">
      <div className="product-page">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Breadcrumb
              onHome={() => navigate("/dashboard")}
              items={[
                { label: "Mes parcours", onClick: () => navigate("/my-learning-paths") },
                { label: pathId ? "Modifier" : "Nouveau parcours" },
              ]}
            />
            <div className="flex items-center gap-2">
              {pathId && (
                <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => navigate(`/learning-path/${pathId}`)}>
                  <Route className="h-4 w-4" />
                  Voir le parcours
                </button>
              )}
              <button
                className="ap-btn ap-btn--pill"
                style={{ background: "var(--ap-brand)", color: "#fff", border: "none", display: "inline-flex", gap: 8 }}
                onClick={handleSave}
                disabled={saving}
              >
                <ButtonShimmerLabel loading={saving}>
                  <Save className="h-4 w-4" />
                  Enregistrer
                </ButtonShimmerLabel>
              </button>
            </div>
          </div>

          <header className="product-template-start" style={{ marginTop: 28 }}>
            <button
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ marginBottom: 12 }}
              onClick={() => navigate("/my-learning-paths")}
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux parcours
            </button>
            <h1>
              {pathId ? "Modifier le parcours" : "Créer un parcours"}
            </h1>
            <p className="ap-muted" style={{ marginTop: 8 }}>
              Organisez plusieurs cours et définissez précisément quand chaque étape devient accessible.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex flex-col gap-6">
              <div className="ap-card">
                <h2 className="ap-h3" style={{ fontSize: 18, marginBottom: 18 }}>Informations générales</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    {fieldLabel("Titre du parcours")}
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex : Devenir autonome sur React" style={inputStyle} />
                  </div>
                  <div>
                    {fieldLabel("Description")}
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Décrivez le résultat attendu et le public concerné…"
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>

              <div className="ap-card">
                <div className="flex flex-wrap items-start justify-between gap-4" style={{ marginBottom: 18 }}>
                  <div>
                    <h2 className="ap-h3" style={{ fontSize: 18 }}>Étapes du parcours</h2>
                    <p className="ap-muted" style={{ fontSize: 13, marginTop: 4 }}>
                      Ajoutez les cours dans l’ordre pédagogique souhaité.
                    </p>
                  </div>
                  <span className="ap-pill">{steps.length} étape{steps.length !== 1 ? "s" : ""}</span>
                </div>

                {courses.length === 0 ? (
                  <div style={{ border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)", padding: 28, textAlign: "center" }}>
                    <BookOpen style={{ width: 28, height: 28, margin: "0 auto 10px", color: "var(--ap-muted)" }} />
                    <p style={{ fontWeight: 800 }}>Aucun cours disponible</p>
                    <p className="ap-muted" style={{ fontSize: 13, margin: "4px 0 14px" }}>Créez d’abord un cours pour pouvoir l’ajouter à ce parcours.</p>
                    <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => navigate("/course-builder")}>
                      <Plus className="h-4 w-4" />
                      Créer un cours
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                      <SelectTrigger style={{ flex: 1, minHeight: 42, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}>
                        <SelectValue placeholder={availableCourses.length > 0 ? "Sélectionner un cours…" : "Tous les cours ont été ajoutés"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCourses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}, {totalLessons(course)} leçon{totalLessons(course) !== 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button className="ap-btn ap-btn--sm ap-btn--pill" disabled={!selectedCourseId} onClick={addCourse}>
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>
                )}

                {steps.length === 0 && courses.length > 0 && (
                  <div style={{ padding: "34px 20px", marginTop: 18, textAlign: "center", border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)" }}>
                    <Route style={{ width: 30, height: 30, color: "var(--ap-muted)", margin: "0 auto 10px" }} />
                    <p className="ap-muted" style={{ fontSize: 13 }}>Le parcours se construira ici, étape par étape.</p>
                  </div>
                )}

                <div className="flex flex-col gap-4" style={{ marginTop: steps.length > 0 ? 20 : 0 }}>
                  {steps.map((step, index) => {
                    const course = courseById.get(step.courseId);
                    const priorSteps = steps.slice(0, index);
                    return (
                      <article key={step.id} style={{ border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", overflow: "hidden", background: "var(--ap-card)" }}>
                        <div className="flex items-center gap-3" style={{ padding: "14px 16px", background: "var(--ap-paper-2)", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                          <div style={{ width: 34, height: 34, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "var(--ap-r-sm)", background: "var(--content-path-accent)", color: "#fff", fontWeight: 900 }}>
                            {index + 1}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h3 className="ap-h3 truncate" style={{ fontSize: 15 }}>{course?.title ?? "Cours supprimé"}</h3>
                            <p className="ap-muted" style={{ fontSize: 12 }}>{course ? `${course.modules.length} modules, ${totalLessons(course)} leçons` : "Cette étape doit être remplacée"}</p>
                          </div>
                          <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" disabled={index === 0} title="Monter" onClick={() => moveStep(index, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" disabled={index === steps.length - 1} title="Descendre" onClick={() => moveStep(index, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" style={{ color: "var(--ap-danger)" }} title="Retirer" onClick={() => removeStep(step.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2" style={{ padding: 16 }}>
                          <div>
                            {fieldLabel("Condition de validation")}
                            <Select
                              value={String(step.requiredCompletionPercentage)}
                              onValueChange={(value) => updateStep(step.id, { requiredCompletionPercentage: Number(value) })}
                            >
                              <SelectTrigger style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[50, 75, 80, 100].map((value) => (
                                  <SelectItem key={value} value={String(value)}>{value}% du cours terminé</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            {fieldLabel("Prérequis")}
                            {index === 0 ? (
                              <p className="ap-muted" style={{ fontSize: 13, paddingTop: 8 }}>Aucun, première étape</p>
                            ) : isSequential ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "var(--content-path-surface)", borderRadius: "var(--ap-r-sm)", fontSize: 12.5, fontWeight: 700 }}>
                                <Link2 className="h-4 w-4" style={{ color: "var(--content-path-accent)" }} />
                                Étape {index} validée automatiquement
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {priorSteps.map((candidate, prerequisiteIndex) => {
                                  const candidateCourse = courseById.get(candidate.courseId);
                                  const checked = step.prerequisiteStepIds.includes(candidate.id);
                                  return (
                                    <label key={candidate.id} className="flex cursor-pointer items-center gap-2" style={{ fontSize: 12.5, fontWeight: 650 }}>
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) => togglePrerequisite(step, candidate.id, value === true)}
                                      />
                                      Étape {prerequisiteIndex + 1} : {candidateCourse?.title ?? "Cours supprimé"}
                                    </label>
                                  );
                                })}
                                {step.prerequisiteStepIds.length === 0 && (
                                  <span className="ap-muted" style={{ fontSize: 12 }}>Accessible sans prérequis</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <div className="ap-card" style={{ position: "sticky", top: "calc(var(--app-header-height, 64px) + 20px)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", background: "var(--content-path-surface)", marginBottom: 14 }}>
                  <GitBranch style={{ width: 24, height: 24, color: "var(--content-path-accent)" }} />
                </div>
                <h2 className="ap-h3" style={{ fontSize: 17 }}>Règle de progression</h2>
                <p className="ap-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0 16px" }}>
                  Contrôlez si les apprenants doivent avancer dans l’ordre ou peuvent choisir leur prochaine étape.
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 0", borderTop: "var(--ap-border-w) solid var(--ap-line)", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800 }}>Progression séquentielle</p>
                    <p className="ap-muted" style={{ fontSize: 11.5, marginTop: 2 }}>Une étape à la fois</p>
                  </div>
                  <Switch checked={isSequential} onCheckedChange={setIsSequential} aria-label="Progression séquentielle" />
                </div>

                <div style={{ marginTop: 16, padding: 13, borderRadius: "var(--ap-r-sm)", background: "var(--ap-paper-2)" }}>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4" style={{ color: "var(--ap-pres-deep)", marginTop: 1, flexShrink: 0 }} />
                    <p className="ap-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {isSequential
                        ? "Chaque cours se débloque lorsque le seuil du cours précédent est atteint."
                        : "Chaque étape peut avoir zéro, un ou plusieurs prérequis explicites."}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
