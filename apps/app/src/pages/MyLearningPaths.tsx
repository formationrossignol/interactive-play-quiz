import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  GitBranch,
  Pencil,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteLearningPath,
  duplicateLearningPath,
  evaluateLearningPath,
  getUserLearningPaths,
  type LearningPath,
} from "@/lib/learningPathStorage";

export default function MyLearningPaths() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [paths, setPaths] = useState<LearningPath[]>([]);

  const reload = () => {
    if (user) setPaths(getUserLearningPaths(user.id));
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setPaths(getUserLearningPaths(user.id));
  }, [navigate, user]);

  const progressByPath = useMemo(
    () => new Map(paths.map((path) => [path.id, evaluateLearningPath(path, user?.id ?? "")])),
    [paths, user?.id],
  );

  const handleDuplicate = (path: LearningPath) => {
    const copy = duplicateLearningPath(path.id);
    if (!copy) {
      toast.error("Impossible de dupliquer ce parcours");
      return;
    }
    reload();
    toast.success("Parcours dupliqué");
  };

  const handleDelete = (path: LearningPath) => {
    if (!window.confirm(`Supprimer définitivement « ${path.title} » ?`)) return;
    if (!deleteLearningPath(path.id)) {
      toast.error("Impossible de supprimer ce parcours");
      return;
    }
    reload();
    toast.success("Parcours supprimé");
  };

  if (!user) return null;

  return (
    <AppLayout subtitle="Mes parcours">
      <div className="product-page">
        <PageHeader
          title="Mes parcours"
          description="Assemblez vos cours, imposez des prérequis et pilotez la progression étape par étape."
          action={(
            <Button onClick={() => navigate("/learning-path-builder")}>
              <Plus className="h-4 w-4" />
              Créer un parcours
            </Button>
          )}
        />

          {paths.length === 0 ? (
            <ExplorerEmptyState
              icon={<Route size={27} />}
              title="Créez votre premier parcours"
              body="Sélectionnez plusieurs cours, définissez leur ordre et choisissez les conditions nécessaires pour débloquer chaque étape."
              action={(
                <Button onClick={() => navigate("/learning-path-builder")}>
                  <Plus className="h-4 w-4" />
                  Créer un parcours
                </Button>
              )}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {paths.map((path) => {
                const progress = progressByPath.get(path.id);
                return (
                  <article
                    key={path.id}
                    className="ap-card ap-card--hover flex flex-col"
                    style={{ minHeight: 260, padding: 0, overflow: "hidden" }}
                  >
                    <div style={{
                      minHeight: 94,
                      padding: "20px 20px 16px",
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--ap-brand) 18%, var(--ap-card)), color-mix(in srgb, var(--ap-pres) 12%, var(--ap-card)))",
                      borderBottom: "var(--ap-border-w) solid var(--ap-line)",
                    }}>
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ width: 42, height: 42, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}>
                          <Route style={{ width: 22, height: 22, color: "var(--ap-brand)" }} />
                        </div>
                        <span className="ap-pill" style={{ fontSize: 11 }}>
                          {path.isSequential ? "Séquentiel" : "Flexible"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col" style={{ padding: "18px 20px" }}>
                      <h2 className="ap-h3" style={{ fontSize: 18 }}>{path.title}</h2>
                      {path.description && (
                        <p className="ap-muted line-clamp-2" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 5 }}>{path.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
                        <span className="ap-pill" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                          <BookOpen className="h-3 w-3" />
                          {path.steps.length} étape{path.steps.length !== 1 ? "s" : ""}
                        </span>
                        <span className="ap-pill" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                          {path.isSequential ? <GitBranch className="h-3 w-3" /> : <Route className="h-3 w-3" />}
                          {path.isSequential ? "Ordre imposé" : "Ordre libre"}
                        </span>
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: 18 }}>
                        <div className="flex items-center justify-between" style={{ fontSize: 12, fontWeight: 700 }}>
                          <span className="ap-muted">Progression</span>
                          <span>{progress?.progressPercentage ?? 0}%</span>
                        </div>
                        <div style={{ height: 6, background: "var(--ap-line)", borderRadius: 999, overflow: "hidden", marginTop: 7 }}>
                          <div style={{
                            height: "100%",
                            width: `${progress?.progressPercentage ?? 0}%`,
                            background: progress?.isComplete ? "var(--ap-pres)" : "var(--ap-brand)",
                            borderRadius: 999,
                          }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2" style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", marginTop: 16, paddingTop: 14 }}>
                        <button className="ap-btn ap-btn--sm ap-btn--ghost ap-icon-btn" title="Modifier" onClick={(event) => { event.stopPropagation(); navigate(`/learning-path-builder?pathId=${path.id}`); }}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="ap-btn ap-btn--sm ap-btn--ghost ap-icon-btn" title="Dupliquer" onClick={(event) => { event.stopPropagation(); handleDuplicate(path); }}>
                          <Copy className="h-4 w-4" />
                        </button>
                        <button className="ap-btn ap-btn--sm ap-btn--ghost ap-icon-btn" style={{ color: "var(--ap-danger)" }} title="Supprimer" onClick={(event) => { event.stopPropagation(); handleDelete(path); }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          className="ap-btn ap-btn--sm ap-btn--pill"
                          style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}
                          onClick={(event) => { event.stopPropagation(); navigate(`/learning-path/${path.id}`); }}
                        >
                          {progress?.isComplete ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                          {progress && progress.completedSteps > 0 ? "Continuer" : "Commencer"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </div>
    </AppLayout>
  );
}
