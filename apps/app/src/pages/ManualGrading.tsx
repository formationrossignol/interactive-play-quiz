import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  Plus,
  Scale,
  UsersRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CreateManualEvaluationDialog } from "@/components/grading/CreateManualEvaluationDialog";
import { ManualGradebook } from "@/components/grading/ManualGradebook";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { ListSkeleton, PageSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { listOwnedManualEvaluations } from "@/lib/grading/gradingRepo";
import type { ManualEvaluation } from "@/lib/grading/types";
import { useSEO } from "@/hooks/useSEO";
import { listGroups, type Group } from "@/lib/sharing/sharingRepo";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function ManualGrading() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState<ManualEvaluation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  useSEO({
    title: "Saisie des notes",
    description: "Créez des évaluations manuelles et saisissez les notes de vos groupes.",
  });

  const selectedId = searchParams.get("evaluation");
  const selectedEvaluation = useMemo(
    () => evaluations.find((evaluation) => evaluation.id === selectedId) ?? evaluations[0] ?? null,
    [evaluations, selectedId],
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const reloadGroups = async () => {
    if (!user) return;
    setGroups(await listGroups(user.id));
  };

  const reloadEvaluations = async (preferredId?: string) => {
    if (!user) return;
    const rows = await listOwnedManualEvaluations(user.id);
    setEvaluations(rows);
    const target = preferredId ?? searchParams.get("evaluation") ?? rows[0]?.id;
    if (target && rows.some((row) => row.id === target)) {
      setSearchParams({ evaluation: target }, { replace: true });
    } else if (rows.length === 0) {
      setSearchParams({}, { replace: true });
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    Promise.all([reloadGroups(), reloadEvaluations()])
      .catch((error) => showError(error, "ManualGrading.load", "Impossible de charger les évaluations."))
      .finally(() => setLoading(false));
  }, [navigate, user?.id]);

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Saisie des notes">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Saisie des notes">
      <div className="product-page">
        <PageHeader
          title="Saisie et gestion des notes"
          description="Notez les devoirs, TP, projets, soutenances et activités en présentiel, puis publiez les résultats au moment choisi."
          action={(
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nouvelle évaluation
            </Button>
          )}
        />

        {evaluations.length === 0 ? (
          <ExplorerEmptyState
            icon={<ClipboardCheck size={27} />}
            title="Créez votre première évaluation"
            body="Choisissez un barème et des groupes. Vous pourrez ensuite saisir les résultats au clavier, coller une colonne depuis un tableur et conserver les notes en brouillon."
            action={(
              <Button onClick={() => setCreateOpen(true)}>
                <FilePlus2 />
                Créer une évaluation
              </Button>
            )}
          />
        ) : (
          <div className="product-workspace-grid">
            <aside className="product-master-panel">
              <div className="product-panel-heading">
                <h2 className="font-extrabold">Mes évaluations</h2>
                <p className="ap-muted mt-1 text-xs">{evaluations.length} évaluation{evaluations.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="product-master-list max-h-[65vh] overflow-y-auto">
                {evaluations.map((evaluation) => {
                  const active = evaluation.id === selectedEvaluation?.id;
                  return (
                    <button
                      key={evaluation.id}
                      type="button"
                      className="product-master-item block"
                      data-active={active}
                      onClick={() => setSearchParams({ evaluation: evaluation.id })}
                    >
                      <strong className="block truncate text-sm">{evaluation.name}</strong>
                      <span className="ap-muted mt-2 flex items-center gap-1.5 text-[11px]">
                        {evaluation.grading_type === "numeric" ? <Scale className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                        {evaluation.grading_type === "numeric" ? `/${evaluation.maximum_score}` : "Validation simple"}
                        <span>·</span>
                        coeff. {evaluation.coefficient}
                      </span>
                      <span className="ap-muted mt-1 flex items-center gap-1.5 text-[11px]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {dateFormatter.format(new Date(`${evaluation.evaluation_date}T12:00:00`))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {selectedEvaluation ? (
              <section className="min-w-0">
                <div className="ap-card mb-5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="ap-h2 text-2xl">{selectedEvaluation.name}</h2>
                      {selectedEvaluation.description && (
                        <p className="ap-muted mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6">{selectedEvaluation.description}</p>
                      )}
                    </div>
                    <span className="ap-pill">
                      {selectedEvaluation.grading_type === "numeric"
                        ? `${selectedEvaluation.minimum_score}–${selectedEvaluation.maximum_score}`
                        : "Validation simple"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedEvaluation.context_label && <span className="ap-pill text-xs">{selectedEvaluation.context_label}</span>}
                    <span className="ap-pill inline-flex items-center gap-1.5 text-xs">
                      <UsersRound className="h-3.5 w-3.5" />
                      {selectedEvaluation.groupIds.map((id) => groupNameById.get(id)).filter(Boolean).join(", ") || "Groupes assignés"}
                    </span>
                    <span className="ap-pill text-xs">Coefficient {selectedEvaluation.coefficient}</span>
                    {selectedEvaluation.pass_threshold !== null && (
                      <span className="ap-pill text-xs">Réussite ≥ {selectedEvaluation.pass_threshold}</span>
                    )}
                    {selectedEvaluation.entry_deadline && (
                      <span className="ap-pill text-xs">Saisie avant le {dateFormatter.format(new Date(selectedEvaluation.entry_deadline))}</span>
                    )}
                  </div>
                </div>

                <ManualGradebook evaluation={selectedEvaluation} groups={groups} />
              </section>
            ) : (
              <div className="ap-card p-5"><ListSkeleton rows={5} /></div>
            )}
          </div>
        )}
      </div>

      <CreateManualEvaluationDialog
        open={createOpen}
        groups={groups}
        onOpenChange={setCreateOpen}
        onGroupsChanged={reloadGroups}
        onCreated={async (evaluationId) => {
          await Promise.all([reloadGroups(), reloadEvaluations(evaluationId)]);
        }}
      />
    </AppLayout>
  );
}
