import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import { usernamesByIds } from "@/lib/sharing/sharingRepo";
import {
  listSessionAttendance,
  listSessionEnrollments,
  recordAttendance,
  type AttendanceStatus,
  type CourseSession,
  type Enrollment,
} from "@/lib/lms/enrollment";

const inputClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Présent", absent: "Absent", late: "Retard", excused: "Excusé",
};

const STATUS_ORDER: AttendanceStatus[] = ["present", "late", "excused", "absent"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SessionAttendancePanelProps {
  session: CourseSession;
}

/** RESTE-A-FAIRE §02: attendance_events — no meeting/occurrence table
 *  exists on course_sessions, so this marks one calendar day at a time
 *  (record_attendance() upserts on (session_id, learner_id, occurred_on)),
 *  same roster-panel shape as SessionRosterPanel. */
export function SessionAttendancePanel({ session }: SessionAttendancePanelProps) {
  const [date, setDate] = useState(todayIso());
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [statuses, setStatuses] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listSessionEnrollments(session.id), listSessionAttendance(session.id, date)])
      .then(async ([enrollmentRows, attendanceRows]) => {
        if (cancelled) return;
        const active = enrollmentRows.filter((e) => e.status === "active");
        setEnrollments(active);
        setStatuses(new Map(attendanceRows.map((a) => [a.learner_id, a.status])));
        const resolved = await usernamesByIds(active.map((e) => e.learner_id));
        if (cancelled) return;
        setNames(new Map(resolved.map((n) => [n.id, n.username])));
      })
      .catch(showError)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.id, date]);

  const mark = async (learnerId: string, status: AttendanceStatus) => {
    setSaving(learnerId);
    try {
      await recordAttendance(session.id, learnerId, date, status);
      setStatuses((prev) => new Map(prev).set(learnerId, status));
    } catch (err) {
      showError(err);
    } finally {
      setSaving(null);
    }
  };

  const markAllPresent = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const e of enrollments) {
      if (statuses.get(e.learner_id) === "present") { ok++; continue; }
      try {
        await recordAttendance(session.id, e.learner_id, date, "present");
        setStatuses((prev) => new Map(prev).set(e.learner_id, "present"));
        ok++;
      } catch {
        // individual failures surface per-row via the missing status; no
        // separate error column here, unlike SessionRosterPanel's bulk ops.
      }
    }
    setBulkBusy(false);
    toast.success(`${ok} apprenant${ok !== 1 ? "s" : ""} marqué${ok !== 1 ? "s" : ""} présent${ok !== 1 ? "s" : ""}`);
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground mt-2">Aucun inscrit actif pour cette session.</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de la séance" />
        <Button variant="ghost" size="sm" loading={bulkBusy} onClick={markAllPresent}>
          <CheckCheck size={14} /> Tout marquer présent
        </Button>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--ap-paper-2)" }}>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Apprenant</th>
              <th className="border-b px-2 py-1.5 text-left text-xs font-bold" style={{ borderColor: "var(--ap-line)" }}>Présence</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                <td className="px-2 py-1.5">@{names.get(e.learner_id) ?? "apprenant"}</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {STATUS_ORDER.map((status) => {
                      const active = statuses.get(e.learner_id) === status;
                      return (
                        <Button
                          key={status}
                          variant={active ? "default" : "ghost"}
                          size="sm"
                          loading={saving === e.learner_id}
                          onClick={() => mark(e.learner_id, status)}
                        >
                          {STATUS_LABEL[status]}
                        </Button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
