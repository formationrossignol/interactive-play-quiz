import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import {
  getCompletionPolicy,
  listSessionEnrollments,
  publishCompletionPolicy,
  recomputeEnrollmentCompletion,
  type CompletionPolicyDefinition,
  type CourseSession,
} from "@/lib/lms/enrollment";

interface CompletionPolicyPanelProps {
  session: CourseSession;
}

/** Règle métier libre de la spec 02 (pas un ENR-0xx numéroté) : "La
 *  complétion est calculée par politique versionnée : activités
 *  obligatoires, score, présence et durée éventuelle." Chaque champ est
 *  optionnel et indépendant côté moteur (voir
 *  _compute_enrollment_completion_internal()) — laisser tout vide publie
 *  une politique qui ne ferme jamais rien automatiquement. */
export function CompletionPolicyPanel({ session }: CompletionPolicyPanelProps) {
  const [requiredIds, setRequiredIds] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minAttendance, setMinAttendance] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const load = () => {
    setLoading(true);
    Promise.all([getCompletionPolicy(session.id), listSessionEnrollments(session.id)])
      .then(([policy, enrollments]) => {
        setActiveCount(enrollments.filter((e) => e.status === "active").length);
        if (!policy) return;
        const def = policy.version.definition;
        setRequiredIds((def.required_assignment_ids ?? []).join(", "));
        setMinScore(def.min_score_pct !== undefined ? String(def.min_score_pct) : "");
        setMinAttendance(def.min_attendance_pct !== undefined ? String(def.min_attendance_pct) : "");
        setMinDuration(def.min_duration_days !== undefined ? String(def.min_duration_days) : "");
        setPublishedVersion(policy.set.published_version);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const handlePublish = async () => {
    setSaving(true);
    try {
      const definition: CompletionPolicyDefinition = {};
      const ids = requiredIds.split(",").map((x) => x.trim()).filter(Boolean);
      if (ids.length > 0) definition.required_assignment_ids = ids;
      if (minScore) definition.min_score_pct = Number(minScore);
      if (minAttendance) definition.min_attendance_pct = Number(minAttendance);
      if (minDuration) definition.min_duration_days = Number(minDuration);

      const result = await publishCompletionPolicy(session.id, definition);
      setPublishedVersion(result.published_version);
      toast.success(`Politique de complétion publiée (v${result.published_version})`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRecomputeAll = async () => {
    setRecomputing(true);
    try {
      const enrollments = await listSessionEnrollments(session.id);
      const active = enrollments.filter((e) => e.status === "active");
      for (const e of active) {
        await recomputeEnrollmentCompletion(e.id);
      }
      toast.success(`${active.length} inscription${active.length !== 1 ? "s" : ""} recalculée${active.length !== 1 ? "s" : ""}`);
    } catch (err) {
      showError(err);
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-2 space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">
        Politique de complétion {publishedVersion ? <span className="text-muted-foreground font-normal">— publiée v{publishedVersion}</span> : <span className="text-muted-foreground font-normal">— aucune publiée</span>}
      </p>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`cp-required-${session.id}`}>Devoirs obligatoires (ids séparés par virgule)</label>
        <Input id={`cp-required-${session.id}`} value={requiredIds} onChange={(e) => setRequiredIds(e.target.value)} placeholder="uuid, uuid…" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[120px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`cp-score-${session.id}`}>Score min. (%)</label>
          <Input id={`cp-score-${session.id}`} type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
        </div>
        <div className="min-w-[120px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`cp-attendance-${session.id}`}>Présence min. (%)</label>
          <Input id={`cp-attendance-${session.id}`} type="number" min={0} max={100} value={minAttendance} onChange={(e) => setMinAttendance(e.target.value)} />
        </div>
        <div className="min-w-[120px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`cp-duration-${session.id}`}>Durée min. (jours)</label>
          <Input id={`cp-duration-${session.id}`} type="number" min={0} value={minDuration} onChange={(e) => setMinDuration(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Recalculée automatiquement chaque nuit pour les {activeCount} inscription{activeCount !== 1 ? "s" : ""} active{activeCount !== 1 ? "s" : ""}. Un critère laissé vide n'est pas exigé.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" loading={saving} onClick={handlePublish}>
          <Save size={14} /> Publier
        </Button>
        <Button size="sm" variant="ghost" loading={recomputing} onClick={handleRecomputeAll} disabled={!publishedVersion}>
          <RefreshCw size={14} /> Recalculer maintenant
        </Button>
      </div>
    </div>
  );
}
