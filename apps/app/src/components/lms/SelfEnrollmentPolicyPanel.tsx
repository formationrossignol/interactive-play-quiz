import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import { usernamesByIds } from "@/lib/sharing/sharingRepo";
import {
  getSessionInviteCode,
  listPendingEnrollments,
  resolvePendingEnrollment,
  setSessionInviteCode,
  updateSessionEnrollmentPolicy,
  type CourseSession,
  type Enrollment,
  type EnrollmentPolicy,
} from "@/lib/lms/enrollment";

const inputClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const MODE_LABEL: Record<NonNullable<EnrollmentPolicy["mode"]>, string> = {
  open: "Ouverte — inscription immédiate",
  approval: "Sur approbation — l'apprenant patiente en attente",
  closed: "Fermée — invitation uniquement, pas d'auto-inscription",
  payment: "Paiement requis — non disponible cette version",
};

type PrereqKind = "none" | "activity_completed" | "score" | "competency";

/** ENR-013 "prérequis" : une seule feuille evaluate_rule_definition(), pas
 *  le constructeur ET/OU complet d'Automation.tsx (ConditionNodeEditor
 *  n'est pas exporté et ce gate n'a besoin que d'un critère, contrairement
 *  aux règles d'automatisation qui composent plusieurs conditions). */
function prerequisiteKind(p: EnrollmentPolicy["prerequisite"]): PrereqKind {
  if (!p || typeof p !== "object") return "none";
  const source = (p as Record<string, unknown>).source;
  if (source === "activity_completed" || source === "score" || source === "competency") return source;
  return "none";
}

interface SelfEnrollmentPolicyPanelProps {
  session: CourseSession;
  onUpdated: (policy: EnrollmentPolicy) => void;
}

export function SelfEnrollmentPolicyPanel({ session, onUpdated }: SelfEnrollmentPolicyPanelProps) {
  const policy = session.enrollment_policy ?? {};
  const [mode, setMode] = useState<NonNullable<EnrollmentPolicy["mode"]>>(policy.mode ?? "open");
  const [emailDomains, setEmailDomains] = useState((policy.email_domains ?? []).join(", "));
  const [requiresCode, setRequiresCode] = useState(Boolean(policy.requires_code));
  const [codeInput, setCodeInput] = useState("");
  const [codeSet, setCodeSet] = useState(false);
  const [prereqKind, setPrereqKind] = useState<PrereqKind>(prerequisiteKind(policy.prerequisite));
  const [prereqTargetId, setPrereqTargetId] = useState(String((policy.prerequisite as Record<string, unknown> | undefined)?.target_id ?? ""));
  const [prereqValue, setPrereqValue] = useState(String((policy.prerequisite as Record<string, unknown> | undefined)?.value ?? ""));
  const [saving, setSaving] = useState(false);

  const [pending, setPending] = useState<Enrollment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (requiresCode) {
      getSessionInviteCode(session.id).then((code) => setCodeSet(Boolean(code))).catch(() => setCodeSet(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const reloadPending = () => {
    setPendingLoading(true);
    listPendingEnrollments(session.id)
      .then(async (rows) => {
        setPending(rows);
        const resolved = await usernamesByIds(rows.map((r) => r.learner_id));
        setNames(new Map(resolved.map((n) => [n.id, n.username])));
      })
      .catch(showError)
      .finally(() => setPendingLoading(false));
  };

  useEffect(() => {
    reloadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const domains = emailDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
      let prerequisite: EnrollmentPolicy["prerequisite"] = null;
      if (prereqKind === "activity_completed" && prereqTargetId.trim()) {
        prerequisite = { source: "activity_completed", target_id: prereqTargetId.trim() };
      } else if (prereqKind === "score" && prereqTargetId.trim() && prereqValue) {
        prerequisite = { source: "score", target_id: prereqTargetId.trim(), operator: "gte", value: Number(prereqValue) };
      } else if (prereqKind === "competency" && prereqTargetId.trim() && prereqValue.trim()) {
        prerequisite = { source: "competency", target_id: prereqTargetId.trim(), operator: "gte", value: prereqValue.trim() };
      }

      const next: EnrollmentPolicy = {
        mode,
        email_domains: domains.length > 0 ? domains : undefined,
        requires_code: requiresCode,
        prerequisite,
      };
      await updateSessionEnrollmentPolicy(session.id, next);
      if (requiresCode && codeInput.trim()) {
        await setSessionInviteCode(session.id, codeInput.trim());
        setCodeSet(true);
        setCodeInput("");
      } else if (!requiresCode) {
        await setSessionInviteCode(session.id, null);
        setCodeSet(false);
      }
      onUpdated(next);
      toast.success("Règles d'auto-inscription enregistrées");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (enrollmentId: string, approve: boolean) => {
    setActingId(enrollmentId);
    try {
      await resolvePendingEnrollment(enrollmentId, approve);
      reloadPending();
    } catch (err) {
      showError(err);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-md border p-3 space-y-3">
        <p className="text-sm font-medium">Auto-inscription (ENR-013)</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor={`policy-mode-${session.id}`}>Mode</label>
            <select
              id={`policy-mode-${session.id}`}
              className={inputClass}
              style={inputStyle}
              value={mode}
              onChange={(e) => setMode(e.target.value as NonNullable<EnrollmentPolicy["mode"]>)}
            >
              {(Object.keys(MODE_LABEL) as Array<NonNullable<EnrollmentPolicy["mode"]>>).map((m) => (
                <option key={m} value={m}>{MODE_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] space-y-1">
            <label className="text-xs font-medium" htmlFor={`policy-domains-${session.id}`}>Domaines email autorisés (optionnel)</label>
            <Input id={`policy-domains-${session.id}`} placeholder="acme.com, ecole.fr" value={emailDomains} onChange={(e) => setEmailDomains(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiresCode} onChange={(e) => setRequiresCode(e.target.checked)} />
            Code d'invitation requis
          </label>
          {requiresCode && (
            <div className="min-w-[180px] space-y-1">
              <label className="text-xs font-medium" htmlFor={`policy-code-${session.id}`}>
                {codeSet ? "Nouveau code (laisser vide pour garder l'actuel)" : "Code"}
              </label>
              <Input id={`policy-code-${session.id}`} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder={codeSet ? "••••••" : "ex. RENTREE2026"} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor={`policy-prereq-${session.id}`}>Prérequis (optionnel, un seul critère)</label>
            <select
              id={`policy-prereq-${session.id}`}
              className={inputClass}
              style={inputStyle}
              value={prereqKind}
              onChange={(e) => setPrereqKind(e.target.value as PrereqKind)}
            >
              <option value="none">Aucun</option>
              <option value="activity_completed">Activité terminée</option>
              <option value="score">Score ≥</option>
              <option value="competency">Compétence ≥ niveau</option>
            </select>
          </div>
          {prereqKind !== "none" && (
            <>
              <div className="min-w-[160px] space-y-1">
                <label className="text-xs font-medium" htmlFor={`policy-prereq-target-${session.id}`}>ID cible</label>
                <Input id={`policy-prereq-target-${session.id}`} value={prereqTargetId} onChange={(e) => setPrereqTargetId(e.target.value)} placeholder="uuid" />
              </div>
              {prereqKind !== "activity_completed" && (
                <div className="min-w-[100px] space-y-1">
                  <label className="text-xs font-medium" htmlFor={`policy-prereq-value-${session.id}`}>
                    {prereqKind === "score" ? "% requis" : "Code niveau"}
                  </label>
                  <Input id={`policy-prereq-value-${session.id}`} value={prereqValue} onChange={(e) => setPrereqValue(e.target.value)} />
                </div>
              )}
            </>
          )}
        </div>

        <Button size="sm" loading={saving} onClick={handleSave}>
          <KeyRound size={14} /> Enregistrer les règles
        </Button>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Demandes en attente d'approbation</p>
        {pendingLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">@{names.get(e.learner_id) ?? "apprenant"}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" loading={actingId === e.id} onClick={() => handleResolve(e.id, false)}>
                    <XCircle size={14} /> Refuser
                  </Button>
                  <Button size="sm" loading={actingId === e.id} onClick={() => handleResolve(e.id, true)}>
                    <CheckCircle2 size={14} /> Approuver
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
