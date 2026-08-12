import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MoveRight, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import { usernamesByIds } from "@/lib/sharing/sharingRepo";
import {
  enrollInSession,
  extendEnrollmentDueDate,
  listSessionEnrollments,
  transitionEnrollment,
  type CourseSession,
  type Enrollment,
  type EnrollmentStatus,
} from "@/lib/lms/enrollment";

const inputClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  invited: "Invité", pending: "En attente", waitlisted: "Liste d'attente",
  active: "Actif", completed: "Terminée", failed: "Échouée",
  withdrawn: "Retirée", cancelled: "Annulée", expired: "Expirée",
};

type RowOutcome = "done" | "error";

interface SessionRosterPanelProps {
  session: CourseSession;
  otherSessions: CourseSession[];
}

export function SessionRosterPanel({ session, otherSessions }: SessionRosterPanelProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, RowOutcome>>({});
  const [dueDate, setDueDate] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [reason, setReason] = useState("");

  const reload = () => {
    setLoading(true);
    listSessionEnrollments(session.id)
      .then(async (rows) => {
        setEnrollments(rows);
        const resolved = await usernamesByIds(rows.map((r) => r.learner_id));
        setNames(new Map(resolved.map((n) => [n.id, n.username])));
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const actionable = useMemo(() => enrollments.filter((e) => e.status === "active" || e.status === "waitlisted"), [enrollments]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected((prev) => (prev.size === actionable.length ? new Set() : new Set(actionable.map((e) => e.id))));

  const runBulk = async (fn: (enrollmentId: string) => Promise<void>, successMsg: (n: number) => string) => {
    setBusy(true);
    const nextOutcomes: Record<string, RowOutcome> = {};
    for (const id of selected) {
      try {
        await fn(id);
        nextOutcomes[id] = "done";
      } catch {
        nextOutcomes[id] = "error";
      }
    }
    setOutcomes(nextOutcomes);
    setBusy(false);
    const successCount = Object.values(nextOutcomes).filter((o) => o === "done").length;
    toast.success(successMsg(successCount));
    reload();
    setSelected(new Set());
  };

  const handleCancel = () => {
    if (selected.size === 0) return;
    void runBulk(
      (id) => transitionEnrollment(id, "cancelled", reason || "Annulation en masse").then(() => undefined),
      (n) => `${n} inscription${n !== 1 ? "s" : ""} annulée${n !== 1 ? "s" : ""}`,
    );
  };

  const handleExtend = () => {
    if (selected.size === 0 || !dueDate) return;
    const iso = new Date(dueDate).toISOString();
    void runBulk(
      (id) => extendEnrollmentDueDate(id, iso, reason || undefined).then(() => undefined),
      (n) => `Échéance prolongée pour ${n} apprenant${n !== 1 ? "s" : ""}`,
    );
  };

  /** Not a single atomic primitive — withdraw then enroll, two existing
   *  calls. If the enroll fails after the withdraw succeeds the learner
   *  ends up nowhere rather than duplicated; that row reports "error" and
   *  needs a manual follow-up, same posture as ENR-014's import report. */
  const handleMove = () => {
    if (selected.size === 0 || !targetSessionId) return;
    void runBulk(
      async (id) => {
        const enrollment = enrollments.find((e) => e.id === id);
        if (!enrollment) throw new Error("not found");
        await transitionEnrollment(id, "withdrawn", reason || `Déplacé vers une autre session`);
        await enrollInSession(targetSessionId, enrollment.learner_id, "manual");
      },
      (n) => `${n} apprenant${n !== 1 ? "s" : ""} déplacé${n !== 1 ? "s" : ""}`,
    );
  };

  if (loading) return <TableSkeleton rows={3} cols={3} />;

  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground mt-2">Aucun inscrit pour cette session.</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-md border overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--ap-paper-2)" }}>
              <th className="border-b px-2 py-1.5 text-left">
                <input type="checkbox" checked={selected.size > 0 && selected.size === actionable.length} onChange={toggleAll} aria-label="Tout sélectionner" />
              </th>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Apprenant</th>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Statut</th>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Échéance</th>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    disabled={e.status !== "active" && e.status !== "waitlisted"}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    aria-label={`Sélectionner @${names.get(e.learner_id) ?? "apprenant"}`}
                  />
                </td>
                <td className="px-2 py-1.5">@{names.get(e.learner_id) ?? "apprenant"}</td>
                <td className="px-2 py-1.5">{STATUS_LABEL[e.status]}</td>
                <td className="px-2 py-1.5">{e.effective_due_at ? new Date(e.effective_due_at).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="px-2 py-1.5">
                  {outcomes[e.id] === "done" && <span style={{ color: "var(--ap-pres)" }}>OK</span>}
                  {outcomes[e.id] === "error" && <span style={{ color: "var(--ap-danger)" }}>Échec</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">{selected.size} sélectionné{selected.size !== 1 ? "s" : ""}</p>
          <input
            className={`${inputClass} w-full`}
            style={inputStyle}
            placeholder="Motif (optionnel, appliqué à l'action)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" loading={busy} onClick={handleCancel}>
              <XCircle size={14} /> Annuler
            </Button>
            <input type="date" className={inputClass} style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Nouvelle échéance" />
            <Button variant="ghost" size="sm" loading={busy} disabled={!dueDate} onClick={handleExtend}>
              <CalendarClock size={14} /> Prolonger
            </Button>
            {otherSessions.length > 0 && (
              <>
                <select className={inputClass} style={inputStyle} value={targetSessionId} onChange={(e) => setTargetSessionId(e.target.value)} aria-label="Session cible">
                  <option value="">Déplacer vers…</option>
                  {otherSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <Button variant="ghost" size="sm" loading={busy} disabled={!targetSessionId} onClick={handleMove}>
                  <MoveRight size={14} /> Déplacer
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
