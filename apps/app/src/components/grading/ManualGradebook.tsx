import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  History,
  LockKeyhole,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import {
  ATTENDANCE_LABELS,
  VALIDATION_LABELS,
  buildGradeCsv,
  computeActivityStats,
  parseLocalizedScore,
  roundGrade,
  validateNumericScore,
} from "@/lib/grading/calculations";
import {
  listEvaluationRoster,
  listManualGradeHistory,
  listManualGrades,
  publishManualGrades,
  saveManualGrade,
} from "@/lib/grading/gradingRepo";
import type {
  AttendanceStatus,
  ManualEvaluation,
  ManualGrade,
  ManualGradeHistory,
  RosterMember,
  ValidationValue,
} from "@/lib/grading/types";
import type { Group } from "@/lib/sharing/sharingRepo";

interface ManualGradebookProps {
  evaluation: ManualEvaluation;
  groups: Group[];
}

interface DraftGrade {
  scoreText: string;
  validationValue: ValidationValue | "";
  attendanceStatus: AttendanceStatus;
  appreciation: string;
}

type StatusFilter = "all" | "missing" | "draft" | "published" | "absence";
type SortMode = "name" | "score-asc" | "score-desc";

const inputClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

function draftFromGrade(grade: ManualGrade | null): DraftGrade {
  return {
    scoreText: grade?.score === null || grade?.score === undefined ? "" : String(grade.score).replace(".", ","),
    validationValue: grade?.validation_value ?? "",
    attendanceStatus: grade?.attendance_status ?? "present",
    appreciation: grade?.appreciation ?? "",
  };
}

function gradeDisplay(
  grade: ManualGrade | undefined,
  evaluation: ManualEvaluation,
): string {
  if (!grade) return "—";
  if (grade.attendance_status !== "present") return ATTENDANCE_LABELS[grade.attendance_status];
  if (evaluation.grading_type === "numeric") {
    return grade.score === null ? "—" : `${grade.score}/${evaluation.maximum_score}`;
  }
  return grade.validation_value ? VALIDATION_LABELS[grade.validation_value] : "—";
}

export function ManualGradebook({ evaluation, groups }: ManualGradebookProps) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [grades, setGrades] = useState<ManualGrade[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftGrade>>({});
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revisionReasons, setRevisionReasons] = useState<Record<string, string>>({});
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [historyGrade, setHistoryGrade] = useState<ManualGrade | null>(null);
  const [history, setHistory] = useState<ManualGradeHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scoreInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const gradesRef = useRef<ManualGrade[]>([]);
  const saveQueuesRef = useRef<Map<string, Promise<boolean>>>(new Map());

  const gradeByLearner = useMemo(
    () => new Map(grades.map((grade) => [grade.learner_id, grade])),
    [grades],
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [members, savedGrades] = await Promise.all([
        listEvaluationRoster(evaluation.groupIds),
        listManualGrades(evaluation.id),
      ]);
      setRoster(members);
      setGrades(savedGrades);
      gradesRef.current = savedGrades;
      const savedByUser = new Map(savedGrades.map((grade) => [grade.learner_id, grade]));
      setDrafts(Object.fromEntries(
        members.map((member) => [member.userId, draftFromGrade(savedByUser.get(member.userId) ?? null)]),
      ));
      setErrors({});
      setRevisionReasons({});
    } catch (error) {
      showError(error, "ManualGradebook.load", "Impossible de charger le tableau de notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [evaluation.id]);

  const visibleRoster = useMemo(() => {
    const filtered = roster.filter((member) => {
      if (groupFilter !== "all" && !member.groupIds.includes(groupFilter)) return false;
      const grade = gradeByLearner.get(member.userId);
      if (statusFilter === "missing") return !grade;
      if (statusFilter === "draft") return grade?.workflow_status === "draft";
      if (statusFilter === "published") return grade?.workflow_status === "published";
      if (statusFilter === "absence") return grade && grade.attendance_status !== "present";
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "name") return left.username.localeCompare(right.username, "fr");
      const leftScore = gradeByLearner.get(left.userId)?.score;
      const rightScore = gradeByLearner.get(right.userId)?.score;
      if (leftScore === null || leftScore === undefined) return 1;
      if (rightScore === null || rightScore === undefined) return -1;
      return sortMode === "score-asc" ? leftScore - rightScore : rightScore - leftScore;
    });
  }, [gradeByLearner, groupFilter, roster, sortMode, statusFilter]);

  const stats = useMemo(
    () => computeActivityStats(grades, evaluation),
    [evaluation, grades],
  );
  const draftCount = grades.filter((grade) => grade.workflow_status === "draft").length;
  const publishedCount = grades.filter((grade) => grade.workflow_status === "published").length;
  const missingCount = Math.max(0, roster.length - grades.length);

  const updateDraft = (learnerId: string, patch: Partial<DraftGrade>) => {
    setDrafts((current) => ({
      ...current,
      [learnerId]: { ...current[learnerId], ...patch },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[learnerId];
      return next;
    });
  };

  const setSaving = (learnerId: string, saving: boolean) => {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(learnerId);
      else next.delete(learnerId);
      return next;
    });
  };

  const persistRowNow = async (
    member: RosterMember,
    workflowStatus: "draft" | "published",
    draft: DraftGrade,
    changeReason = "",
  ): Promise<boolean> => {
    const existing = gradesRef.current.find((grade) => grade.learner_id === member.userId);
    let score: number | null = null;
    if (evaluation.grading_type === "numeric" && draft.attendanceStatus === "present") {
      const validationError = validateNumericScore(draft.scoreText, evaluation);
      if (validationError) {
        setErrors((current) => ({ ...current, [member.userId]: validationError }));
        return false;
      }
      score = parseLocalizedScore(draft.scoreText);
    }

    setSaving(member.userId, true);
    try {
      const saved = await saveManualGrade({
        evaluationId: evaluation.id,
        learnerId: member.userId,
        score,
        validationValue: evaluation.grading_type === "validation" && draft.attendanceStatus === "present"
          ? draft.validationValue || null
          : null,
        attendanceStatus: draft.attendanceStatus,
        appreciation: draft.appreciation,
        workflowStatus,
        expectedVersion: existing?.version ?? 0,
        changeReason,
      });
      const nextGrades = [
        ...gradesRef.current.filter((grade) => grade.learner_id !== member.userId),
        saved,
      ];
      gradesRef.current = nextGrades;
      setGrades(nextGrades);
      setDrafts((current) => ({ ...current, [member.userId]: draftFromGrade(saved) }));
      setErrors((current) => {
        const next = { ...current };
        delete next[member.userId];
        return next;
      });
      return true;
    } catch (error) {
      const classified = showError(error, "ManualGradebook.save", "La note n’a pas pu être enregistrée.");
      setErrors((current) => ({ ...current, [member.userId]: classified.message }));
      if (/version conflict/i.test(error instanceof Error ? error.message : "")) void load();
      return false;
    } finally {
      setSaving(member.userId, false);
    }
  };

  const persistRow = (
    member: RosterMember,
    workflowStatus: "draft" | "published",
    override?: DraftGrade,
    changeReason = "",
  ): Promise<boolean> => {
    const draft = override ?? drafts[member.userId] ?? draftFromGrade(null);
    const previous = saveQueuesRef.current.get(member.userId) ?? Promise.resolve(true);
    const queued = previous
      .catch(() => false)
      .then(() => persistRowNow(member, workflowStatus, draft, changeReason));
    saveQueuesRef.current.set(member.userId, queued);
    void queued.finally(() => {
      if (saveQueuesRef.current.get(member.userId) === queued) {
        saveQueuesRef.current.delete(member.userId);
      }
    });
    return queued;
  };

  const handleAttendanceChange = (member: RosterMember, attendanceStatus: AttendanceStatus) => {
    const next = {
      ...(drafts[member.userId] ?? draftFromGrade(null)),
      attendanceStatus,
      ...(attendanceStatus === "present" ? {} : { scoreText: "", validationValue: "" as const }),
    };
    updateDraft(member.userId, next);
    if (gradeByLearner.get(member.userId)?.workflow_status !== "published") {
      void persistRow(member, "draft", next);
    }
  };

  const handlePublishRow = async (member: RosterMember) => {
    if (await persistRow(member, "published")) toast.success(`Note de @${member.username} publiée`);
  };

  const startRevision = (member: RosterMember) => {
    const reason = window.prompt("Motif obligatoire de la révision :");
    if (!reason || reason.trim().length < 3) return;
    setRevisionReasons((current) => ({ ...current, [member.userId]: reason.trim() }));
  };

  const saveRevision = async (member: RosterMember) => {
    const reason = revisionReasons[member.userId];
    if (!reason) return;
    if (await persistRow(member, "published", undefined, reason)) {
      setRevisionReasons((current) => {
        const next = { ...current };
        delete next[member.userId];
        return next;
      });
      toast.success("Révision enregistrée et historisée");
    }
  };

  const handleBulkPublish = async () => {
    try {
      await Promise.all([...saveQueuesRef.current.values()]);
      const count = await publishManualGrades(evaluation.id);
      await load();
      toast.success(count
        ? `${count} note${count !== 1 ? "s" : ""} publiée${count !== 1 ? "s" : ""}`
        : "Aucun brouillon complet à publier");
    } catch (error) {
      showError(error, "ManualGradebook.publish", "La publication groupée a échoué.");
    }
  };

  const handlePaste = async (
    event: React.ClipboardEvent<HTMLInputElement>,
    startMember: RosterMember,
  ) => {
    const values = event.clipboardData.getData("text")
      .split(/\r?\n/)
      .map((line) => line.split("\t")[0]?.trim() ?? "")
      .filter((value, index, all) => value !== "" || index < all.length - 1);
    if (values.length <= 1) return;
    event.preventDefault();

    const startIndex = visibleRoster.findIndex((member) => member.userId === startMember.userId);
    const changes: Array<{ member: RosterMember; draft: DraftGrade }> = [];
    for (let offset = 0; offset < values.length; offset += 1) {
      const member = visibleRoster[startIndex + offset];
      if (!member || gradeByLearner.get(member.userId)?.workflow_status === "published") continue;
      const error = validateNumericScore(values[offset], evaluation);
      if (error) {
        toast.error(`Ligne ${offset + 1} : ${error}`);
        return;
      }
      changes.push({
        member,
        draft: {
          ...(drafts[member.userId] ?? draftFromGrade(null)),
          scoreText: values[offset].replace(".", ","),
          attendanceStatus: "present",
        },
      });
    }
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(changes.map(({ member, draft }) => [member.userId, draft])),
    }));
    for (const change of changes) {
      await persistRow(change.member, "draft", change.draft);
    }
    toast.success(`${changes.length} note${changes.length !== 1 ? "s" : ""} collée${changes.length !== 1 ? "s" : ""}`);
  };

  const focusNextScore = (member: RosterMember) => {
    const index = visibleRoster.findIndex((item) => item.userId === member.userId);
    const next = visibleRoster[index + 1];
    if (next) scoreInputsRef.current[next.userId]?.focus();
  };

  const downloadCsv = () => {
    const csv = buildGradeCsv(evaluation, roster.map((member) => ({
      username: member.username,
      grade: gradeByLearner.get(member.userId) ?? null,
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${evaluation.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "notes"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openHistory = async (grade: ManualGrade) => {
    setHistoryGrade(grade);
    setHistory([]);
    setHistoryLoading(true);
    try {
      setHistory(await listManualGradeHistory(grade.id));
    } catch (error) {
      showError(error, "ManualGradebook.history", "Impossible de charger l’historique.");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) return <div className="ap-card p-5"><TableSkeleton rows={7} cols={5} /></div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Apprenants", value: roster.length },
          { label: "Manquantes", value: missingCount },
          { label: "Brouillons", value: draftCount },
          { label: "Publiées", value: publishedCount },
          {
            label: evaluation.grading_type === "numeric" ? "Moyenne" : "Taux validé",
            value: evaluation.grading_type === "numeric"
              ? stats.mean === null ? "—" : `${roundGrade(stats.mean, evaluation.rounding_rule)}/${evaluation.maximum_score}`
              : stats.passRate === null ? "—" : `${Math.round(stats.passRate)} %`,
          },
        ].map((stat) => (
          <div key={stat.label} className="ap-card p-4">
            <strong className="block text-xl">{stat.value}</strong>
            <span className="ap-muted text-xs">{stat.label}</span>
          </div>
        ))}
      </div>

      <section className="ap-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 p-4" style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
          <select className={inputClass} style={inputStyle} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Filtrer par groupe">
            <option value="all">Tous les groupes</option>
            {evaluation.groupIds.map((groupId) => (
              <option key={groupId} value={groupId}>{groupNameById.get(groupId) ?? "Groupe"}</option>
            ))}
          </select>
          <select className={inputClass} style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrer par statut">
            <option value="all">Tous les statuts</option>
            <option value="missing">Sans saisie</option>
            <option value="draft">Brouillons</option>
            <option value="published">Publiées</option>
            <option value="absence">Absences et exceptions</option>
          </select>
          <select className={inputClass} style={inputStyle} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Trier les notes">
            <option value="name">Nom A–Z</option>
            {evaluation.grading_type === "numeric" && (
              <>
                <option value="score-desc">Note décroissante</option>
                <option value="score-asc">Note croissante</option>
              </>
            )}
          </select>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download />
              Export CSV
            </Button>
            <Button size="sm" disabled={draftCount === 0} onClick={() => void handleBulkPublish()}>
              <Send />
              Publier les brouillons
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr style={{ background: "var(--ap-paper-2)" }}>
                {["Apprenant", "Note / validation", "Présence", "Appréciation", "Publication", "Actions"].map((label) => (
                  <th key={label} className="border-b px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--ap-line)", color: "var(--ap-muted)" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="font-bold">Aucun apprenant pour ce filtre</p>
                    <p className="ap-muted mt-1 text-xs">Ajoutez des membres aux groupes ou modifiez les filtres.</p>
                  </td>
                </tr>
              ) : visibleRoster.map((member) => {
                const grade = gradeByLearner.get(member.userId);
                const draft = drafts[member.userId] ?? draftFromGrade(grade ?? null);
                const revising = Boolean(revisionReasons[member.userId]);
                const locked = grade?.workflow_status === "published" && !revising;
                const saving = savingIds.has(member.userId);
                return (
                  <tr key={member.userId} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                    <td className="px-3 py-3 align-top">
                      <strong className="block">@{member.username}</strong>
                      <span className="ap-muted mt-1 block max-w-40 truncate text-[11px]">
                        {member.groupIds.map((id) => groupNameById.get(id)).filter(Boolean).join(", ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {evaluation.grading_type === "numeric" ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={(node) => { scoreInputsRef.current[member.userId] = node; }}
                              className={`${inputClass} w-24 text-right font-bold`}
                              style={inputStyle}
                              value={draft.scoreText}
                              disabled={locked || draft.attendanceStatus !== "present" || saving}
                              inputMode="decimal"
                              aria-label={`Note de ${member.username}`}
                              onChange={(event) => updateDraft(member.userId, { scoreText: event.target.value })}
                              onBlur={() => {
                                if (grade?.workflow_status !== "published") void persistRow(member, "draft");
                              }}
                              onPaste={(event) => void handlePaste(event, member)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  event.currentTarget.blur();
                                  focusNextScore(member);
                                }
                              }}
                            />
                            <span className="font-bold">/{evaluation.maximum_score}</span>
                          </div>
                          {errors[member.userId] && (
                            <span className="mt-1 flex max-w-52 items-start gap-1 text-[11px]" style={{ color: "var(--ap-danger)" }}>
                              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                              {errors[member.userId]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <select
                          className={`${inputClass} w-40`}
                          style={inputStyle}
                          value={draft.validationValue}
                          disabled={locked || draft.attendanceStatus !== "present" || saving}
                          onChange={(event) => {
                            const next = { ...draft, validationValue: event.target.value as ValidationValue | "" };
                            updateDraft(member.userId, next);
                            if (grade?.workflow_status !== "published") void persistRow(member, "draft", next);
                          }}
                        >
                          <option value="">Non saisie</option>
                          {Object.entries(VALIDATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select
                        className={`${inputClass} w-44`}
                        style={inputStyle}
                        value={draft.attendanceStatus}
                        disabled={locked || saving}
                        onChange={(event) => handleAttendanceChange(member, event.target.value as AttendanceStatus)}
                      >
                        {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        className={`${inputClass} w-full min-w-56`}
                        style={inputStyle}
                        value={draft.appreciation}
                        disabled={locked || saving}
                        maxLength={10000}
                        placeholder="Ajouter une appréciation"
                        onChange={(event) => updateDraft(member.userId, { appreciation: event.target.value })}
                        onBlur={() => {
                          if (grade?.workflow_status !== "published") void persistRow(member, "draft");
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      {grade?.workflow_status === "published" ? (
                        <span className="ap-pill inline-flex items-center gap-1 text-xs" style={{ color: "var(--ap-pres)" }}>
                          <LockKeyhole className="h-3.5 w-3.5" /> Publiée
                        </span>
                      ) : grade ? (
                        <span className="ap-pill inline-flex items-center gap-1 text-xs">
                          <Clock3 className="h-3.5 w-3.5" /> Brouillon
                        </span>
                      ) : (
                        <span className="ap-muted text-xs">Non saisie</span>
                      )}
                      {saving && <span className="ap-muted mt-1 block text-[11px]">Enregistrement…</span>}
                      {grade && !saving && <span className="ap-muted mt-1 block text-[11px]">v{grade.version}</span>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1">
                        {grade?.workflow_status === "published" ? (
                          revising ? (
                            <Button size="sm" loading={saving} onClick={() => void saveRevision(member)}>
                              <Save /> Enregistrer
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => startRevision(member)}>
                              Réviser
                            </Button>
                          )
                        ) : (
                          <Button variant="outline" size="sm" loading={saving} onClick={() => void handlePublishRow(member)}>
                            <Check /> Publier
                          </Button>
                        )}
                        {grade && (
                          <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                            title="Historique"
                            aria-label={`Historique de ${member.username}`}
                            onClick={() => void openHistory(grade)}
                          >
                            <History className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs" style={{ color: "var(--ap-muted)" }}>
          <span>{visibleRoster.length} apprenant{visibleRoster.length !== 1 ? "s" : ""}</span>
          <span>Tab pour avancer · Entrée pour passer à la note suivante · collage multi-lignes accepté</span>
        </div>
      </section>

      {evaluation.grading_type === "numeric" && stats.graded > 0 && (
        <div className="ap-card flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
          <span>Médiane <strong>{roundGrade(stats.median!, evaluation.rounding_rule)}</strong></span>
          <span>Minimum <strong>{stats.minimum}</strong></span>
          <span>Maximum <strong>{stats.maximum}</strong></span>
          {stats.passRate !== null && <span>Taux de réussite <strong>{Math.round(stats.passRate)} %</strong></span>}
        </div>
      )}

      <Dialog open={Boolean(historyGrade)} onOpenChange={(open) => { if (!open) setHistoryGrade(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
          <DialogHeader>
            <DialogTitle>Historique des modifications</DialogTitle>
            <DialogDescription>
              État actuel : {historyGrade ? gradeDisplay(historyGrade, evaluation) : ""}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : history.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: "var(--ap-line)" }}>
              <History className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--ap-muted)" }} />
              <p className="font-bold">Aucune modification historisée</p>
              <p className="ap-muted mt-1 text-xs">La création initiale constitue l’état de référence.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <article key={entry.id} className="rounded-lg border p-4" style={{ borderColor: "var(--ap-line)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{entry.reason || "Modification"}</strong>
                    <time className="ap-muted text-xs">{new Date(entry.changed_at).toLocaleString("fr-FR")}</time>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-md p-2" style={{ background: "var(--ap-paper-2)" }}>
                      <span className="ap-muted block font-bold">Avant</span>
                      <code className="mt-1 block whitespace-pre-wrap">{JSON.stringify(entry.old_value, null, 2)}</code>
                    </div>
                    <div className="rounded-md p-2" style={{ background: "var(--ap-brand-soft)" }}>
                      <span className="block font-bold">Après</span>
                      <code className="mt-1 block whitespace-pre-wrap">{JSON.stringify(entry.new_value, null, 2)}</code>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
