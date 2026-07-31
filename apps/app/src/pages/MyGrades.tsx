import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  History,
  MessageSquareText,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  ATTENDANCE_LABELS,
  VALIDATION_LABELS,
  computeWeightedAverage,
} from "@/lib/grading/calculations";
import {
  listManualGradeHistory,
  listMyPublishedGrades,
} from "@/lib/grading/gradingRepo";
import type {
  ManualGradeHistory,
  PublishedGrade,
} from "@/lib/grading/types";
import { useSEO } from "@/hooks/useSEO";

const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(value));

function resultLabel(grade: PublishedGrade) {
  if (grade.attendance_status !== "present") return ATTENDANCE_LABELS[grade.attendance_status];
  if (grade.evaluation.grading_type === "numeric") {
    return grade.score === null ? "Non évalué" : `${grade.score}/${grade.evaluation.maximum_score}`;
  }
  return grade.validation_value ? VALIDATION_LABELS[grade.validation_value] : "Non évalué";
}

function passed(grade: PublishedGrade): boolean | null {
  if (grade.attendance_status !== "present") return null;
  if (grade.evaluation.grading_type === "validation") {
    return grade.validation_value === "validated";
  }
  if (grade.score === null || grade.evaluation.pass_threshold === null) return null;
  return grade.score >= grade.evaluation.pass_threshold;
}

export default function MyGrades() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [grades, setGrades] = useState<PublishedGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyGrade, setHistoryGrade] = useState<PublishedGrade | null>(null);
  const [history, setHistory] = useState<ManualGradeHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  useSEO({ title: "Mes notes", description: "Consultez vos notes et appréciations publiées." });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    listMyPublishedGrades(user.id)
      .then(setGrades)
      .catch((error) => showError(error, "MyGrades.load", "Impossible de charger vos notes."))
      .finally(() => setLoading(false));
  }, [navigate, user?.id]);

  const average = useMemo(() => computeWeightedAverage(grades), [grades]);
  const successCount = grades.filter((grade) => passed(grade) === true).length;

  const openHistory = async (grade: PublishedGrade) => {
    setHistoryGrade(grade);
    setHistory([]);
    setHistoryLoading(true);
    try {
      setHistory(await listManualGradeHistory(grade.id));
    } catch (error) {
      showError(error, "MyGrades.history", "Impossible de charger l’historique.");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout subtitle="Mes notes">
      <div className="product-page">
        <PageHeader
          title="Mes notes"
          description="Retrouvez vos résultats, barèmes, coefficients et appréciations. Les brouillons restent invisibles."
        />

        {loading ? (
          <section className="ap-card p-5"><ListSkeleton rows={6} /></section>
        ) : grades.length === 0 ? (
          <section className="ap-card border-dashed px-6 py-14 text-center">
            <ClipboardList className="mx-auto mb-4 h-12 w-12" style={{ color: "var(--ap-brand)" }} />
            <h2 className="ap-h2 text-xl">Aucune note publiée</h2>
            <p className="ap-muted mx-auto mt-2 max-w-lg text-sm">
              Vos résultats apparaîtront ici lorsque votre enseignant les aura publiés.
            </p>
          </section>
        ) : (
          <>
            <div className="product-metric-grid">
              <div className="product-metric">
                <span className="product-metric__icon"><Scale className="h-5 w-5" /></span>
                <div><strong>{average === null ? "-" : `${Math.round(average * 10) / 10}/20`}</strong><small>Moyenne pondérée</small></div>
              </div>
              <div className="product-metric">
                <span className="product-metric__icon"><ClipboardList className="h-5 w-5" /></span>
                <div><strong>{grades.length}</strong><small>Résultats publiés</small></div>
              </div>
              <div className="product-metric">
                <span className="product-metric__icon" style={{ color: "var(--ap-pres)" }}><Award className="h-5 w-5" /></span>
                <div><strong>{successCount}</strong><small>Évaluations validées</small></div>
              </div>
            </div>

            <div className="space-y-4">
              {grades.map((grade) => {
                const isPassed = passed(grade);
                return (
                  <article key={grade.id} className="ap-card overflow-hidden p-0">
                    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="ap-h2 text-xl">{grade.evaluation.name}</h2>
                          {isPassed !== null && (
                            <span className="ap-pill inline-flex items-center gap-1 text-xs" style={{ color: isPassed ? "var(--ap-pres)" : "var(--ap-danger)" }}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {isPassed ? "Réussi" : "À renforcer"}
                            </span>
                          )}
                        </div>
                        <div className="ap-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {grade.evaluation.context_label && <span>{grade.evaluation.context_label}</span>}
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(`${grade.evaluation.evaluation_date}T12:00:00`)}</span>
                          <span>Coefficient {grade.evaluation.coefficient}</span>
                          <span>Publié le {formatDate(grade.published_at!)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <strong className="block text-2xl" style={{ color: grade.attendance_status === "present" ? "var(--ap-brand)" : "var(--ap-muted)" }}>
                          {resultLabel(grade)}
                        </strong>
                        {grade.evaluation.grading_type === "numeric" && grade.evaluation.pass_threshold !== null && (
                          <span className="ap-muted text-[11px]">Seuil : {grade.evaluation.pass_threshold}/{grade.evaluation.maximum_score}</span>
                        )}
                      </div>
                    </div>

                    {grade.appreciation && (
                      <div className="flex gap-3 border-t px-5 py-4" style={{ borderColor: "var(--ap-line)", background: "var(--ap-paper-2)" }}>
                        <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--ap-brand)" }} />
                        <div>
                          <strong className="text-xs uppercase tracking-wide">Appréciation</strong>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{grade.appreciation}</p>
                        </div>
                      </div>
                    )}

                    {grade.version > 1 && (
                      <div className="flex justify-end border-t px-5 py-3" style={{ borderColor: "var(--ap-line)" }}>
                        <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => void openHistory(grade)}>
                          <History className="h-4 w-4" />
                          Historique des révisions
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(historyGrade)} onOpenChange={(open) => { if (!open) setHistoryGrade(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
          <DialogHeader>
            <DialogTitle>Historique : {historyGrade?.evaluation.name}</DialogTitle>
            <DialogDescription>Les révisions publiées de votre résultat.</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <ListSkeleton rows={4} withAvatar={false} />
          ) : history.length === 0 ? (
            <p className="ap-muted py-6 text-center text-sm">Aucune révision disponible.</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <article key={entry.id} className="rounded-lg border p-4" style={{ borderColor: "var(--ap-line)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{entry.reason || "Mise à jour"}</strong>
                    <time className="ap-muted text-xs">{new Date(entry.changed_at).toLocaleString("fr-FR")}</time>
                  </div>
                  <p className="ap-muted mt-2 text-xs">Une nouvelle version de la note ou de l’appréciation a été publiée.</p>
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
