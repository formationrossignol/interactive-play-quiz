import { useEffect, useMemo, useState } from "react";
import { Download, TableProperties, Upload } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import { usernamesByIds } from "@/lib/sharing/sharingRepo";
import { GradebookImportDialog } from "@/components/lms/GradebookImportDialog";
import {
  listGradeResultsForItems,
  listSessionGradeItems,
  type GradeItem,
  type GradeResult,
} from "@/lib/lms/gradebook";
import { listOrgSessions, listSessionEnrollments, type CourseSession, type Enrollment, type EnrollmentStatus } from "@/lib/lms/enrollment";
import { SOURCE_LABEL, cellFor, computeLearnerTotals, type GradeCell, type LearnerTotals } from "@/lib/lms/gradebookCalculations";
import { exportGradebook, type GradebookExportFormat } from "@/lib/lms/gradebookExport";

const STAFF_ROLES = new Set(["trainer", "pedago", "registrar", "admin"]);
const ROSTER_STATUSES: EnrollmentStatus[] = ["active", "completed", "failed"];

const inputClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

function statusLabel(status: GradeCell["status"]): string {
  if (status === "excused") return "Dispensé";
  if (status === "missing") return "Non remis";
  if (status === "not_graded") return "Non noté";
  return "";
}

function cellDisplay(cell: GradeCell, maxPoints: number): string {
  if (cell.status !== "graded" || cell.points === null) return statusLabel(cell.status);
  return `${cell.points}/${maxPoints}`;
}

interface LearnerRow {
  learnerId: string;
  name: string;
  username: string | null;
  enrollmentStatus: EnrollmentStatus;
}

function SessionGradebook({ orgId, session }: { orgId: string; session: CourseSession }) {
  const [items, setItems] = useState<GradeItem[]>([]);
  const [results, setResults] = useState<GradeResult[]>([]);
  const [roster, setRoster] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropLowestCategories, setDropLowestCategories] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "all">("all");
  const [expandedTotal, setExpandedTotal] = useState<string | null>(null);
  const [exporting, setExporting] = useState<GradebookExportFormat | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [gradeItems, enrollments] = await Promise.all([
          listSessionGradeItems(orgId, session.id),
          listSessionEnrollments(session.id),
        ]);
        const relevant = enrollments.filter((e) => ROSTER_STATUSES.includes(e.status));
        const [gradeResults, names] = await Promise.all([
          listGradeResultsForItems(gradeItems.map((item) => item.id)),
          usernamesByIds(relevant.map((e) => e.learner_id)),
        ]);
        if (cancelled) return;
        const nameById = new Map(names.map((n) => [n.id, n.username]));
        setItems(gradeItems);
        setResults(gradeResults);
        setRoster(relevant.map((e) => ({
          learnerId: e.learner_id,
          name: nameById.get(e.learner_id) ? `@${nameById.get(e.learner_id)}` : "Apprenant",
          username: nameById.get(e.learner_id) ?? null,
          enrollmentStatus: e.status,
        })).sort((a, b) => a.name.localeCompare(b.name, "fr")));
      } catch (err) {
        showError(err, "SessionGradebook.load", "Impossible de charger le carnet de notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, session.id, reloadKey]);

  const resultsByLearnerAndItem = useMemo(() => {
    const map = new Map<string, Map<string, GradeResult>>();
    for (const result of results) {
      const byItem = map.get(result.learner_id) ?? new Map<string, GradeResult>();
      byItem.set(result.grade_item_id, result);
      map.set(result.learner_id, byItem);
    }
    return map;
  }, [results]);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "fr")),
    [items],
  );

  const visibleRoster = useMemo(
    () => (statusFilter === "all" ? roster : roster.filter((r) => r.enrollmentStatus === statusFilter)),
    [roster, statusFilter],
  );

  const totalsByLearner = useMemo(() => {
    const map = new Map<string, LearnerTotals>();
    for (const learner of visibleRoster) {
      map.set(learner.learnerId, computeLearnerTotals(
        learner.learnerId,
        items,
        resultsByLearnerAndItem.get(learner.learnerId) ?? new Map(),
        dropLowestCategories,
      ));
    }
    return map;
  }, [visibleRoster, items, resultsByLearnerAndItem, dropLowestCategories]);

  const toggleDropLowest = (category: string) => {
    setDropLowestCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  const handleExport = async (format: GradebookExportFormat) => {
    setExporting(format);
    try {
      await exportGradebook(format, {
        sessionLabel: session.label,
        items,
        categories,
        rows: visibleRoster.map((learner) => {
          const totals = totalsByLearner.get(learner.learnerId)!;
          const byItem = resultsByLearnerAndItem.get(learner.learnerId) ?? new Map();
          return {
            learnerName: learner.name,
            cells: Object.fromEntries(items.map((item) => [item.id, cellFor(item, byItem.get(item.id))])),
            categoryTotals: Object.fromEntries(totals.categories.map((c) => [c.category, c.percentage])),
            overallPercentage: totals.overall.percentage,
          };
        }),
      });
    } catch (err) {
      showError(err, "SessionGradebook.export", "L'export a échoué.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div className="ap-card p-5"><TableSkeleton rows={7} cols={5} /></div>;

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <ExplorerEmptyState
          icon={<TableProperties size={27} />}
          title="Aucune note à consolider pour cette session"
          body="Publiez des notes de devoir, d'examen ou d'évaluation manuelle pour cette session — elles apparaîtront ici automatiquement. Vous pouvez aussi importer une première colonne de notes."
          action={<Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload /> Importer un CSV/XLSX</Button>}
        />
        <GradebookImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          orgId={orgId}
          sessionId={session.id}
          roster={roster.map((r) => ({ learnerId: r.learnerId, username: r.username }))}
          onImported={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={inputClass}
          style={inputStyle}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | "all")}
          aria-label="Filtrer par statut d'inscription"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="completed">Terminés</option>
          <option value="failed">Échoués</option>
        </select>
        {categories.map((category) => (
          <label key={category} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ap-muted)" }}>
            <input
              type="checkbox"
              checked={dropLowestCategories.has(category)}
              onChange={() => toggleDropLowest(category)}
            />
            Exclure la plus basse note en « {category} »
          </label>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload /> Importer
          </Button>
          <Button variant="outline" size="sm" loading={exporting === "CSV"} onClick={() => void handleExport("CSV")}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" loading={exporting === "Excel"} onClick={() => void handleExport("Excel")}>
            <Download /> XLSX
          </Button>
          <Button variant="outline" size="sm" loading={exporting === "PDF"} onClick={() => void handleExport("PDF")}>
            <Download /> PDF
          </Button>
        </div>
      </div>

      <GradebookImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={orgId}
        sessionId={session.id}
        roster={roster.map((r) => ({ learnerId: r.learnerId, username: r.username }))}
        onImported={() => setReloadKey((k) => k + 1)}
      />

      <div className="ap-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr style={{ background: "var(--ap-paper-2)" }}>
                <th className="border-b px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--ap-line)", color: "var(--ap-muted)" }}>
                  Apprenant
                </th>
                {items.map((item) => (
                  <th key={item.id} className="border-b px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--ap-line)", color: "var(--ap-muted)" }}>
                    {item.title}
                    <span className="mt-0.5 block font-normal normal-case" style={{ color: "var(--ap-muted)" }}>
                      {SOURCE_LABEL[item.source_type] ?? item.source_type} · /{item.max_points} · coef. {item.weight}
                    </span>
                  </th>
                ))}
                {categories.map((category) => (
                  <th key={category} className="border-b px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--ap-line)", color: "var(--ap-muted)" }}>
                    {category}
                  </th>
                ))}
                <th className="border-b px-3 py-3 text-left text-xs font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--ap-line)", color: "var(--ap-muted)" }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRoster.length === 0 ? (
                <tr>
                  <td colSpan={items.length + categories.length + 2} className="px-4 py-12 text-center">
                    <p className="font-bold">Aucun apprenant pour ce filtre</p>
                  </td>
                </tr>
              ) : visibleRoster.map((learner) => {
                const byItem = resultsByLearnerAndItem.get(learner.learnerId) ?? new Map();
                const totals = totalsByLearner.get(learner.learnerId)!;
                const categoryByName = new Map(totals.categories.map((c) => [c.category, c]));
                return (
                  <tr key={learner.learnerId} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                    <td className="px-3 py-3 align-top font-medium">{learner.name}</td>
                    {items.map((item) => {
                      const cell = cellFor(item, byItem.get(item.id));
                      return (
                        <td key={item.id} className="px-3 py-3 align-top">
                          {cell.status === "graded" ? (
                            <strong>{cellDisplay(cell, item.max_points)}</strong>
                          ) : (
                            <span className="ap-muted text-xs">{cellDisplay(cell, item.max_points)}</span>
                          )}
                        </td>
                      );
                    })}
                    {categories.map((category) => {
                      const total = categoryByName.get(category);
                      return (
                        <td key={category} className="px-3 py-3 align-top">
                          {total?.percentage === null || total?.percentage === undefined ? (
                            <span className="ap-muted text-xs">—</span>
                          ) : (
                            <span>{total.percentage.toFixed(1)}%</span>
                          )}
                          {total?.droppedTitle && (
                            <span className="ap-muted mt-0.5 block text-[10px]">{total.droppedTitle} exclue</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm"
                        onClick={() => setExpandedTotal((cur) => (cur === learner.learnerId ? null : learner.learnerId))}
                      >
                        {totals.overall.percentage === null ? "—" : `${totals.overall.percentage.toFixed(1)}%`}
                      </button>
                      {expandedTotal === learner.learnerId && (
                        <p className="ap-muted mt-1 max-w-64 text-[11px]" style={{ wordBreak: "break-word" }}>
                          {totals.overall.formula}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LmsGradebook() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  useSEO({ title: "Gradebook", description: "Carnet de notes consolidé par session — devoirs, examens et évaluations manuelles." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setMembershipsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) { setSessions([]); setSessionsLoading(false); return; }
    setSessionsLoading(true);
    listOrgSessions(activeOrgId)
      .then((list) => {
        setSessions(list);
        setSelectedSessionId((current) => (list.some((s) => s.id === current) ? current : list[0]?.id ?? ""));
      })
      .catch((err) => showError(err, "LmsGradebook.sessions"))
      .finally(() => setSessionsLoading(false));
  }, [activeOrgId]);

  const isStaff = useMemo(
    () => memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role)),
    [memberships, activeOrgId],
  );

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  if (membershipsLoading) {
    return (
      <AppLayout subtitle="Gradebook">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Gradebook">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Gradebook"
          description="Vue consolidée par session : devoirs, examens et évaluations manuelles réunis par apprenant."
        />
        {!isStaff || !activeOrgId ? (
          <ExplorerEmptyState
            icon={<TableProperties size={27} />}
            title="Accès réservé au staff"
            body="Formateur, pédagogue, gestionnaire ou administrateur d'organisation."
          />
        ) : sessionsLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : sessions.length === 0 ? (
          <ExplorerEmptyState
            icon={<TableProperties size={27} />}
            title="Aucune session"
            body="Créez une session pour cette organisation avant de consulter son carnet de notes."
          />
        ) : (
          <div className="space-y-4">
            <select
              className={inputClass}
              style={{ ...inputStyle, minWidth: 260 }}
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              aria-label="Session"
            >
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.code})</option>)}
            </select>
            {selectedSession && <SessionGradebook orgId={activeOrgId} session={selectedSession} />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
