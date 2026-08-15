import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  listOrgAssessments,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  submitAssessmentMediaResponse,
  submitAssessmentResponse,
  uploadAssessmentResponseMedia,
  type Assessment,
  type AssessmentAttempt,
  type AttemptItem,
} from "@/lib/lms/itemBank";

/** Response shape per item_type — mirrors item_answer_keys.correct_answer's
 *  contract (see 20260812060000_assessment_correction_engine.sql). */
type ResponseValue = boolean | { optionId: string } | { optionIds: string[] } | { text: string } | { value: unknown } | { assignments: Record<string, string> };

function ItemAnswer({ item, savedResponse, onAnswered }: {
  item: AttemptItem;
  savedResponse: unknown;
  onAnswered: (responseId: string, patch: { is_correct: boolean | null; points_earned: number | null; max_points: number }) => void;
}) {
  const [saving, setSaving] = useState(false);
  // ANA-009: rough proxy for "time spent on this item" — all items render
  // at once (free navigation, not one-per-screen), so this is elapsed time
  // since the item mounted, not focused dwell time. Documented limitation,
  // not a precise instrument.
  const shownAtRef = useRef(Date.now());
  const [feedback, setFeedback] = useState<{ is_correct: boolean; points_earned: number; max_points: number } | null>(null);
  const [textValue, setTextValue] = useState(
    item.item_type === "short_answer" && savedResponse && typeof savedResponse === "object"
      ? String((savedResponse as { text?: string }).text ?? "")
      : "",
  );
  const [richValue, setRichValue] = useState(
    savedResponse && typeof savedResponse === "object" && "value" in savedResponse
      ? JSON.stringify((savedResponse as { value: unknown }).value)
      : "",
  );
  const [assignments, setAssignments] = useState<Record<string, string>>(
    item.item_type === "labeling" && savedResponse && typeof savedResponse === "object" && "assignments" in savedResponse
      ? ((savedResponse as { assignments?: Record<string, string> }).assignments ?? {})
      : {},
  );
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(
    savedResponse && typeof savedResponse === "object" && "file_name" in savedResponse
      ? String((savedResponse as { file_name?: string }).file_name ?? "")
      : null,
  );
  const options = item.prompt.options ?? [];
  const selectedOptionId = item.item_type === "single_choice" && savedResponse && typeof savedResponse === "object"
    ? (savedResponse as { optionId?: string }).optionId
    : undefined;
  const selectedOptionIds = item.item_type === "mcq" && savedResponse && typeof savedResponse === "object"
    ? (savedResponse as { optionIds?: string[] }).optionIds ?? []
    : [];
  const tfValue = item.item_type === "true_false" && typeof savedResponse === "boolean" ? savedResponse : null;

  const submit = async (value: ResponseValue) => {
    setSaving(true);
    try {
      const result = await submitAssessmentResponse(item.response_id, value, Date.now() - shownAtRef.current);
      setFeedback(
        result.is_correct === null || result.points_earned === null
          ? null
          : { is_correct: result.is_correct, points_earned: result.points_earned, max_points: result.max_points },
      );
      onAnswered(item.response_id, { is_correct: result.is_correct, points_earned: result.points_earned, max_points: result.max_points });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const submitAssignments = (next: Record<string, string>) => {
    setAssignments(next);
    void submit({ assignments: next });
  };

  const submitMedia = async (file: File, kind: "audio" | "video" | "file") => {
    setUploading(true);
    try {
      const upload = await uploadAssessmentResponseMedia(file, item.response_id);
      const requiresConsent = item.item_type === "audio_video";
      if (requiresConsent && !consent) {
        showError(new Error("Le consentement est requis avant l'envoi."));
        return;
      }
      await submitAssessmentMediaResponse(item.response_id, upload, kind, requiresConsent ? consent : undefined);
      setUploadedName(file.name);
      // audio_video/file are never auto-scored (grading_status stays
      // pending_review) — nothing meaningful to feed into onAnswered's
      // is_correct/points_earned, just mark the item as answered.
      onAnswered(item.response_id, { is_correct: null, points_earned: null, max_points: 0 });
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="rounded-md border p-3 space-y-2">
      {item.prompt.passage && (
        <div className="mb-2 rounded-md border border-dashed p-3 text-sm" style={{ background: "var(--ap-paper-2)" }}>
          {item.prompt.passage.text && <p>{item.prompt.passage.text}</p>}
          {item.prompt.passage.mediaUrl && <a href={item.prompt.passage.mediaUrl} target="_blank" rel="noopener noreferrer">Support du passage</a>}
        </div>
      )}
      <p className="font-medium">{item.prompt.text}</p>

      {item.item_type === "true_false" && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name={`tf-${item.response_id}`} checked={tfValue === true} disabled={saving} onChange={() => void submit(true)} /> Vrai
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name={`tf-${item.response_id}`} checked={tfValue === false} disabled={saving} onChange={() => void submit(false)} /> Faux
          </label>
        </div>
      )}

      {item.item_type === "single_choice" && (
        <div className="space-y-1">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-1.5 text-sm">
              <input type="radio" name={`sc-${item.response_id}`} checked={selectedOptionId === o.id} disabled={saving} onChange={() => void submit({ optionId: o.id })} />
              {o.label}
            </label>
          ))}
        </div>
      )}

      {item.item_type === "mcq" && (
        <div className="space-y-1">
          {options.map((o) => {
            const checked = selectedOptionIds.includes(o.id);
            return (
              <label key={o.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox" checked={checked} disabled={saving}
                  onChange={() => {
                    const next = checked ? selectedOptionIds.filter((id) => id !== o.id) : [...selectedOptionIds, o.id];
                    void submit({ optionIds: next });
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}

      {item.item_type === "short_answer" && (
        <div className="flex items-center gap-2">
          <Input
            value={textValue}
            disabled={saving}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={() => { if (textValue.trim()) void submit({ text: textValue.trim() }); }}
            placeholder="Votre réponse…"
            className="max-w-sm"
          />
        </div>
      )}

      {item.item_type === "labeling" && (
        <div className="space-y-1.5">
          {(item.prompt.targets ?? []).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-[160px]">{t.text}</span>
              <select
                value={assignments[t.id] ?? ""}
                disabled={saving}
                onChange={(e) => submitAssignments({ ...assignments, [t.id]: e.target.value })}
                className="h-9 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
                aria-label={`Étiquette pour ${t.text}`}
              >
                <option value="">Choisir une étiquette…</option>
                {(item.prompt.labels ?? []).map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {(item.item_type === "audio_video" || item.item_type === "file") && (
        <div className="space-y-2">
          {item.prompt.instructions && <p className="text-sm text-muted-foreground">{item.prompt.instructions}</p>}
          {item.item_type === "audio_video" && (
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={consent} disabled={saving || uploading} onChange={(e) => setConsent(e.target.checked)} />
              J'accepte l'enregistrement de ma réponse audio/vidéo
            </label>
          )}
          <input
            type="file"
            aria-label="Déposer un fichier"
            accept={item.item_type === "audio_video" ? "audio/*,video/*" : undefined}
            disabled={saving || uploading || (item.item_type === "audio_video" && !consent)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const kind = item.item_type === "audio_video" ? (item.prompt.kind ?? "video") : "file";
              void submitMedia(file, kind);
            }}
          />
          {uploading && <p className="text-xs text-muted-foreground">Envoi…</p>}
          {uploadedName && !uploading && <p className="text-xs" style={{ color: "var(--ap-pres)" }}>Déposé : {uploadedName} — revue par un formateur</p>}
        </div>
      )}

      {!(["true_false", "single_choice", "mcq", "short_answer", "audio_video", "file", "labeling"] as string[]).includes(item.item_type) && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground" htmlFor={`rich-${item.response_id}`}>Votre réponse</label>
          <textarea
            id={`rich-${item.response_id}`}
            value={richValue}
            disabled={saving}
            onChange={(e) => setRichValue(e.target.value)}
            onBlur={() => { if (richValue.trim()) void submit({ value: richValue.trim() }); }}
            className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
            placeholder="Décrivez votre réponse…"
          />
          <p className="text-xs text-muted-foreground">Cette interaction sera revue par un formateur.</p>
        </div>
      )}

      {feedback && (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: feedback.is_correct ? "var(--ap-pres)" : "var(--ap-danger)" }}>
          {feedback.is_correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {feedback.is_correct ? "Correct" : "Incorrect"} · {feedback.points_earned}/{feedback.max_points} pt{feedback.max_points > 1 ? "s" : ""}
        </p>
      )}
    </li>
  );
}

function AttemptRunner({ assessment, onDone }: { assessment: Assessment; onDone: () => void }) {
  const [items, setItems] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  useEffect(() => {
    startAssessmentAttempt(assessment.id)
      .then((rows) => {
        setItems(rows);
        setAnswered(new Set(rows.filter((r) => r.response !== null).map((r) => r.response_id)));
      })
      .catch((err) => showError(err, "AttemptRunner.start", "Impossible de démarrer la tentative."))
      .finally(() => setLoading(false));
  }, [assessment.id]);

  const attemptId = items[0]?.attempt_id;

  const handleSubmitAttempt = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      setResult(await submitAssessmentAttempt(attemptId));
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={1} />;

  if (result) {
    return (
      <div className="rounded-md border p-4 text-center space-y-1">
        <p className="text-2xl font-bold">{result.percentage}%</p>
        <p className="text-sm text-muted-foreground">{result.total_points} / {result.max_points} points</p>
        <Button variant="outline" size="sm" onClick={onDone}>Retour</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2" aria-label="Questions">
        {items.map((item) => (
          <ItemAnswer
            key={item.response_id}
            item={item}
            savedResponse={item.response}
            onAnswered={(id) => setAnswered((prev) => new Set(prev).add(id))}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{answered.size}/{items.length} répondu{answered.size > 1 ? "s" : ""}</p>
        <Button size="sm" loading={submitting} onClick={handleSubmitAttempt}>Terminer</Button>
      </div>
    </div>
  );
}

function AssessmentRow({ assessment }: { assessment: Assessment }) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <li className="rounded-md border p-3">
        <p className="font-medium mb-2">{assessment.title}</p>
        <AttemptRunner assessment={assessment} onDone={() => setActive(false)} />
      </li>
    );
  }

  return (
    <li className="rounded-md border p-3 flex items-center justify-between">
      <span className="font-medium">{assessment.title}</span>
      <Button size="sm" onClick={() => setActive(true)}>Commencer</Button>
    </li>
  );
}

export default function LmsTakeAssessment() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  useSEO({ title: "Évaluations", description: "Évaluations publiées disponibles pour votre organisation." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) { setAssessmentsLoading(false); return; }
    listOrgAssessments(activeOrgId).then(setAssessments).catch(showError).finally(() => setAssessmentsLoading(false));
  }, [activeOrgId]);

  const publishedAssessments = useMemo(() => assessments.filter((a) => a.status === "published"), [assessments]);

  if (loading) {
    return (
      <AppLayout subtitle="Évaluations">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Évaluations">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Évaluations"
          description="Vos réponses sont corrigées côté serveur — les bonnes réponses ne sont jamais envoyées au navigateur."
        />
        {!activeOrgId ? (
          <ExplorerEmptyState icon={<ClipboardList size={27} />} title="Aucune organisation" body="Rejoignez une organisation pour accéder à ses évaluations." />
        ) : assessmentsLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : publishedAssessments.length === 0 ? (
          <ExplorerEmptyState icon={<ClipboardList size={27} />} title="Aucune évaluation publiée" body="Les évaluations publiées par votre organisation apparaîtront ici." />
        ) : (
          <ul className="space-y-2" aria-label="Évaluations disponibles">
            {publishedAssessments.map((a) => <AssessmentRow key={a.id} assessment={a} />)}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
