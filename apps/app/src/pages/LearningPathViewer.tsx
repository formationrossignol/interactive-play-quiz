import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Lock,
  Pencil,
  Route,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentUser } from "@/lib/auth";
import type { Module } from "@/lib/courseStorage";
import {
  evaluateLearningPath,
  getLearningPathById,
  type LearningPath,
} from "@/lib/learningPathStorage";

const courseMinutes = (modules: Module[]) =>
  modules.reduce(
    (total, module) => total + module.lessons.reduce((lessonTotal, lesson) => lessonTotal + (lesson.estimatedMinutes ?? 0), 0),
    0,
  );

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
};

export default function LearningPathViewer() {
  const navigate = useNavigate();
  const { pathId } = useParams<{ pathId: string }>();
  const user = getCurrentUser();
  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!pathId) {
      navigate("/my-learning-paths");
      return;
    }
    const stored = getLearningPathById(pathId);
    if (!stored || stored.userId !== user.id) {
      toast.error("Parcours introuvable");
      navigate("/my-learning-paths");
      return;
    }
    setPath(stored);
  }, [navigate, pathId, user]);

  const progress = useMemo(
    () => path && user ? evaluateLearningPath(path, user.id) : null,
    [path, user],
  );

  if (!user || !path || !progress) return null;

  const totalMinutes = progress.steps.reduce(
    (total, state) => total + (state.course ? courseMinutes(state.course.modules) : 0),
    0,
  );
  const nextStep = progress.steps.find((state) => !state.isComplete && !state.isLocked);

  return (
    <AppLayout subtitle={path.title}>
      <div style={{ minHeight: "calc(100vh - var(--app-header-height, 64px))" }}>
        <div style={{
          padding: "22px clamp(20px, 5vw, 64px) 42px",
          background: "linear-gradient(145deg, color-mix(in srgb, var(--ap-brand) 13%, var(--ap-paper)), color-mix(in srgb, var(--ap-pres) 9%, var(--ap-paper)))",
          borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        }}>
          <div style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Breadcrumb
                onHome={() => navigate("/dashboard")}
                items={[
                  { label: "Mes parcours", onClick: () => navigate("/my-learning-paths") },
                  { label: path.title },
                ]}
              />
              <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => navigate(`/learning-path-builder?pathId=${path.id}`)}>
                <Pencil className="h-4 w-4" />
                Modifier
              </button>
            </div>

            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_300px]" style={{ marginTop: 42 }}>
              <div>
                <span className="ap-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <Route className="h-3.5 w-3.5" />
                  Parcours {path.isSequential ? "séquentiel" : "flexible"}
                </span>
                <h1 className="ap-h1" style={{ fontSize: "clamp(32px, 5vw, 50px)", maxWidth: 780 }}>{path.title}</h1>
                {path.description && (
                  <p className="ap-muted" style={{ fontSize: 16, lineHeight: 1.65, maxWidth: 720, marginTop: 14 }}>{path.description}</p>
                )}
                <div className="flex flex-wrap gap-4" style={{ marginTop: 22, fontSize: 13, fontWeight: 750 }}>
                  <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {path.steps.length} cours</span>
                  {totalMinutes > 0 && <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {formatDuration(totalMinutes)}</span>}
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {progress.completedSteps} terminé{progress.completedSteps !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="ap-card" style={{ padding: 20, background: "color-mix(in srgb, var(--ap-card) 92%, transparent)" }}>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="ap-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Progression globale</p>
                    <p className="ap-h2" style={{ fontSize: 34, marginTop: 3 }}>{progress.progressPercentage}%</p>
                  </div>
                  {progress.isComplete && <Trophy style={{ width: 30, height: 30, color: "var(--ap-flash-deep)" }} />}
                </div>
                <div style={{ height: 8, background: "var(--ap-line)", borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
                  <div style={{
                    width: `${progress.progressPercentage}%`,
                    height: "100%",
                    background: progress.isComplete ? "var(--ap-flash)" : "var(--ap-brand)",
                    transition: "width .3s",
                  }} />
                </div>
                {nextStep && (
                  <button
                    className="ap-btn ap-btn--pill"
                    style={{ width: "100%", justifyContent: "center", background: "var(--ap-brand)", color: "#fff", border: "none", marginTop: 16 }}
                    onClick={() => navigate(`/course/${nextStep.step.courseId}?pathId=${path.id}`)}
                  >
                    {nextStep.progressPercentage > 0 ? "Continuer" : "Commencer"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <main style={{ padding: "38px clamp(20px, 5vw, 64px) 64px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div className="flex items-end justify-between gap-4" style={{ marginBottom: 22 }}>
              <div>
                <p className="ap-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em" }}>Programme</p>
                <h2 className="ap-h2" style={{ fontSize: 26, marginTop: 4 }}>Votre progression étape par étape</h2>
              </div>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => navigate("/my-learning-paths")}>
                <ArrowLeft className="h-4 w-4" />
                Mes parcours
              </button>
            </div>

            {progress.isComplete && (
              <div className="ap-card" style={{ marginBottom: 22, padding: 20, background: "color-mix(in srgb, var(--ap-flash) 14%, var(--ap-card))", borderColor: "color-mix(in srgb, var(--ap-flash-deep) 35%, var(--ap-line))" }}>
                <div className="flex items-center gap-4">
                  <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--ap-flash)" }}>
                    <Trophy style={{ width: 24, height: 24, color: "var(--ap-ink)" }} />
                  </div>
                  <div>
                    <h3 className="ap-h3" style={{ fontSize: 18 }}>Parcours terminé</h3>
                    <p className="ap-muted" style={{ fontSize: 13, marginTop: 3 }}>Toutes les conditions de progression ont été validées.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col">
              {progress.steps.map((state, index) => {
                const prerequisiteNames = state.unmetPrerequisiteStepIds
                  .map((id) => {
                    const prerequisiteIndex = path.steps.findIndex((step) => step.id === id);
                    return prerequisiteIndex >= 0 ? `étape ${prerequisiteIndex + 1}` : "un prérequis";
                  })
                  .join(", ");
                const current = nextStep?.step.id === state.step.id;
                return (
                  <div key={state.step.id} className="grid grid-cols-[42px_minmax(0,1fr)] gap-4">
                    <div className="flex flex-col items-center">
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        color: state.isComplete ? "#fff" : state.isLocked ? "var(--ap-muted)" : "var(--ap-brand)",
                        background: state.isComplete ? "var(--ap-pres-deep)" : "var(--ap-card)",
                        border: `2px solid ${state.isComplete ? "var(--ap-pres-deep)" : current ? "var(--ap-brand)" : "var(--ap-line-2)"}`,
                        zIndex: 1,
                      }}>
                        {state.isComplete ? <Check className="h-5 w-5" /> : state.isLocked ? <Lock className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </div>
                      {index < progress.steps.length - 1 && (
                        <div style={{ width: 2, minHeight: 34, flex: 1, background: state.isComplete ? "var(--ap-pres-deep)" : "var(--ap-line)", margin: "4px 0" }} />
                      )}
                    </div>

                    <article
                      className="ap-card"
                      style={{
                        marginBottom: index < progress.steps.length - 1 ? 18 : 0,
                        opacity: state.isLocked ? 0.72 : 1,
                        borderColor: current ? "color-mix(in srgb, var(--ap-brand) 55%, var(--ap-line))" : undefined,
                        boxShadow: current ? "0 8px 28px color-mix(in srgb, var(--ap-brand) 12%, transparent)" : undefined,
                      }}
                    >
                      <div className="flex flex-wrap items-start gap-4">
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 7 }}>
                            <span className="ap-pill" style={{ fontSize: 10.5 }}>Étape {index + 1}</span>
                            {state.isComplete && <span className="ap-pill" style={{ fontSize: 10.5, color: "var(--ap-pres-deep)" }}>Validée</span>}
                            {state.isLocked && <span className="ap-pill" style={{ fontSize: 10.5 }}>Verrouillée</span>}
                            {current && <span className="ap-pill" style={{ fontSize: 10.5, color: "var(--ap-brand)" }}>À suivre</span>}
                          </div>
                          <h3 className="ap-h3" style={{ fontSize: 18 }}>{state.course?.title ?? "Cours indisponible"}</h3>
                          {state.course?.description && (
                            <p className="ap-muted" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 5 }}>{state.course.description}</p>
                          )}

                          <div className="flex flex-wrap gap-3" style={{ marginTop: 12, fontSize: 12, fontWeight: 700 }}>
                            {state.course && <span>{state.course.modules.length} module{state.course.modules.length !== 1 ? "s" : ""}</span>}
                            <span>Seuil : {state.step.requiredCompletionPercentage}%</span>
                            {state.isLocked && <span className="ap-muted">Requiert {prerequisiteNames}</span>}
                          </div>

                          <div style={{ marginTop: 15 }}>
                            <div className="flex items-center justify-between" style={{ fontSize: 11.5, fontWeight: 750 }}>
                              <span className="ap-muted">Cours terminé à</span>
                              <span>{state.progressPercentage}%</span>
                            </div>
                            <div style={{ height: 5, background: "var(--ap-line)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                              <div style={{
                                height: "100%",
                                width: `${state.progressPercentage}%`,
                                background: state.isComplete ? "var(--ap-pres-deep)" : "var(--ap-brand)",
                              }} />
                            </div>
                          </div>
                        </div>

                        <button
                          className="ap-btn ap-btn--sm ap-btn--pill"
                          disabled={state.isLocked || !state.course}
                          style={state.isLocked ? undefined : { background: current ? "var(--ap-brand)" : undefined, color: current ? "#fff" : undefined, border: current ? "none" : undefined }}
                          onClick={() => navigate(`/course/${state.step.courseId}?pathId=${path.id}`)}
                        >
                          {state.isLocked
                            ? <><Lock className="h-4 w-4" /> Verrouillé</>
                            : state.isComplete
                              ? <><CheckCircle2 className="h-4 w-4" /> Revoir</>
                              : <><BookOpen className="h-4 w-4" /> {state.progressPercentage > 0 ? "Continuer" : "Commencer"}</>}
                        </button>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
