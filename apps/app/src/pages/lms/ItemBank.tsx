import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, FlaskConical, Layers, Plus, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  addFixedSection,
  addPoolRule,
  addPoolSection,
  addItemRef,
  createAssessment,
  createItem,
  createItemRevision,
  gradeAssessmentResponse,
  getPlacementThresholds,
  getResponseFileSignedUrl,
  importLegacyQuizAsAssessment,
  listAssessmentSections,
  listItemRevisions,
  listOrgAssessments,
  listOrgItems,
  listPendingReviewResponses,
  listResponseFiles,
  listSectionItemRefs,
  publishAssessment,
  publishPlacementThresholds,
  simulateItemScoring,
  type Assessment,
  type AssessmentItem,
  type AssessmentItemRef,
  type AssessmentSection,
  type ItemOption,
  type ItemRevision,
  type PendingReviewResponse,
  type PlacementThreshold,
  type SimulationResult,
} from "@/lib/lms/itemBank";
import {
  addCollectionMember,
  createItemCollection,
  executeRescore,
  grantItemPermission,
  listCollectionMembers,
  listItemCollections,
  listItemPermissions,
  previewRescore,
  removeCollectionMember,
  revokeItemPermission,
  type ItemCollection,
  type ItemCollectionMember,
  type ItemPermission,
} from "@/lib/lms/itemCollections";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);
/** All formats supported by the assessment runner. Rich formats are stored
 *  for human review when no automatic comparator exists. */
const AUTHORABLE_TYPES = [
  "mcq", "single_choice", "true_false", "short_answer", "ranking", "matching", "cloze",
  "interactive_video", "audio_video", "drawing", "labeling", "math_graph", "file", "code",
] as const;
type ScorableType = string;

function OptionsEditor({ options, onChange, mode, correctIds, onCorrectChange }: {
  options: ItemOption[];
  onChange: (options: ItemOption[]) => void;
  mode: "single" | "multi";
  correctIds: string[];
  onCorrectChange: (ids: string[]) => void;
}) {
  const addOption = () => onChange([...options, { id: crypto.randomUUID(), label: "" }]);
  const updateLabel = (id: string, label: string) => onChange(options.map((o) => (o.id === id ? { ...o, label } : o)));
  const removeOption = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
    onCorrectChange(correctIds.filter((c) => c !== id));
  };
  const toggleCorrect = (id: string) => {
    if (mode === "single") onCorrectChange([id]);
    else onCorrectChange(correctIds.includes(id) ? correctIds.filter((c) => c !== id) : [...correctIds, id]);
  };

  return (
    <div className="space-y-1.5">
      {options.map((o, index) => (
        <div key={o.id} className="flex items-center gap-2">
          <input
            type={mode === "single" ? "radio" : "checkbox"}
            name={mode === "single" ? "correct-option" : undefined}
            checked={correctIds.includes(o.id)}
            onChange={() => toggleCorrect(o.id)}
            aria-label={`Marquer l'option ${index + 1} correcte`}
          />
          <Input value={o.label} onChange={(e) => updateLabel(o.id, e.target.value)} placeholder={`Option ${index + 1}`} className="flex-1" />
          <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer l'option" onClick={() => removeOption(o.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOption}><Plus size={14} /> Ajouter une option</Button>
    </div>
  );
}

/** ASM-013: item_answer_keys is never readable client-side (RLS: no policy
 *  at all for `authenticated`, not even staff) — so testing a hypothetical
 *  answer has to round-trip through simulate_item_scoring(), which reuses
 *  the exact same comparator submit_assessment_response() uses. The
 *  options rendered here come from revision.prompt (never secret); only
 *  correct_answer stays server-side. */
function SimulateForm({ item, revision }: { item: AssessmentItem; revision: ItemRevision }) {
  const itemType = item.item_type as ScorableType;
  const options = revision.prompt.options ?? [];
  const [tfAnswer, setTfAnswer] = useState<"true" | "false">("true");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const toggleOption = (id: string) => {
    setResult(null);
    if (itemType === "single_choice") setSelectedIds([id]);
    else setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canTest = itemType === "true_false" || (itemType === "short_answer" ? text.trim().length > 0 : selectedIds.length > 0);

  const handleTest = async () => {
    setTesting(true);
    try {
      let response: unknown;
      if (itemType === "true_false") response = tfAnswer === "true";
      else if (itemType === "single_choice") response = { optionId: selectedIds[0] };
      else if (itemType === "mcq") response = { optionIds: selectedIds };
      else response = { text: text.trim() };
      setResult(await simulateItemScoring(revision.id, response));
    } catch (err) {
      showError(err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border p-3 space-y-2" style={{ background: "var(--ap-paper-2)" }}>
      <p className="text-xs font-medium text-muted-foreground">Réponse hypothétique — jamais enregistrée, ne révèle pas la clé</p>
      {itemType === "true_false" && (
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={tfAnswer === "true"} onChange={() => { setTfAnswer("true"); setResult(null); }} /> Vrai</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={tfAnswer === "false"} onChange={() => { setTfAnswer("false"); setResult(null); }} /> Faux</label>
        </div>
      )}
      {(itemType === "single_choice" || itemType === "mcq") && (
        <div className="space-y-1 text-sm">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-1.5">
              <input type={itemType === "single_choice" ? "radio" : "checkbox"} checked={selectedIds.includes(o.id)} onChange={() => toggleOption(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
      {itemType === "short_answer" && (
        <Input value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder="Réponse hypothétique" />
      )}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" loading={testing} disabled={!canTest} onClick={handleTest}>Tester</Button>
        {result && (
          <span className="text-sm font-medium" style={{ color: result.is_correct ? "var(--ap-pres)" : "var(--ap-danger)" }}>
            {result.is_correct ? "Correct" : "Incorrect"} · {result.points_earned}/{result.max_points} pts
          </span>
        )}
      </div>
    </div>
  );
}

function ItemRevisions({ item }: { item: AssessmentItem }) {
  const itemType = item.item_type as ScorableType;
  const [revisions, setRevisions] = useState<ItemRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [points, setPoints] = useState("1");
  const [options, setOptions] = useState<ItemOption[]>([{ id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" }]);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [partialCredit, setPartialCredit] = useState(false);
  const [penaltyPerWrong, setPenaltyPerWrong] = useState("1");
  const [tfCorrect, setTfCorrect] = useState<"true" | "false">("true");
  const [equivalents, setEquivalents] = useState<string[]>([""]);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [labelTargets, setLabelTargets] = useState([{ id: crypto.randomUUID(), text: "" }]);
  const [labelChoices, setLabelChoices] = useState([{ id: crypto.randomUUID(), text: "" }]);
  const [labelAssignments, setLabelAssignments] = useState<Record<string, string>>({});
  const [labelPartialCredit, setLabelPartialCredit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [impact, setImpact] = useState<Record<string, number>>({});
  const [rescoreReason, setRescoreReason] = useState("");
  const [executingRescore, setExecutingRescore] = useState(false);

  useEffect(() => {
    listItemRevisions(item.id).then(setRevisions).catch(showError).finally(() => setLoading(false));
  }, [item.id]);

  const resetForm = () => {
    setPromptText(""); setPoints("1");
    setOptions([{ id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" }]);
    setCorrectIds([]); setPartialCredit(false); setPenaltyPerWrong("1");
    setTfCorrect("true"); setEquivalents([""]); setCaseSensitive(false);
    setLabelTargets([{ id: crypto.randomUUID(), text: "" }]);
    setLabelChoices([{ id: crypto.randomUUID(), text: "" }]);
    setLabelAssignments({}); setLabelPartialCredit(true);
  };

  const inspectRescore = async (revisionId: string) => {
    setRescoringId(revisionId);
    try {
      const rows = await previewRescore(revisionId);
      setImpact((prev) => ({ ...prev, [revisionId]: rows.length }));
    } catch (err) { showError(err); }
  };

  const runRescore = async (revisionId: string) => {
    if (!rescoreReason.trim()) return;
    setExecutingRescore(true);
    try { await executeRescore(revisionId, rescoreReason.trim()); setRescoreReason(""); await inspectRescore(revisionId); }
    catch (err) { showError(err); }
    finally { setExecutingRescore(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!promptText.trim()) return;
    const pts = Number(points) || 1;

    setSaving(true);
    try {
      if (itemType === "true_false") {
        await createItemRevision({
          itemId: item.id, prompt: { text: promptText.trim() },
          correctAnswer: tfCorrect === "true", scoringRules: { points: pts },
          changelog: `Révision ${revisions.length + 1}`,
        });
      } else if (itemType === "single_choice" || itemType === "mcq") {
        const filled = options.filter((o) => o.label.trim());
        if (filled.length < 2) { setFormError("Au moins 2 options requises."); return; }
        const validCorrect = correctIds.filter((id) => filled.some((o) => o.id === id));
        if (validCorrect.length === 0) { setFormError("Marquez au moins une option correcte."); return; }
        const revision = await (async () => {
          if (itemType === "single_choice") {
            return createItemRevision({
              itemId: item.id, prompt: { text: promptText.trim(), options: filled },
              correctAnswer: { optionId: validCorrect[0] }, scoringRules: { points: pts },
              changelog: `Révision ${revisions.length + 1}`,
            });
          }
          return createItemRevision({
            itemId: item.id, prompt: { text: promptText.trim(), options: filled },
            correctAnswer: { optionIds: validCorrect },
            scoringRules: { points: pts, partialCredit, penaltyPerWrong: Number(penaltyPerWrong) || 0 },
            changelog: `Révision ${revisions.length + 1}`,
          });
        })();
        setRevisions((prev) => [revision, ...prev]);
        resetForm();
        return;
      } else if (itemType === "short_answer") {
        const filled = equivalents.map((e2) => e2.trim()).filter(Boolean);
        if (filled.length === 0) { setFormError("Au moins une réponse acceptée requise."); return; }
        await createItemRevision({
          itemId: item.id, prompt: { text: promptText.trim() },
          correctAnswer: { equivalents: filled }, scoringRules: { points: pts, caseSensitive },
          changelog: `Révision ${revisions.length + 1}`,
        });
      } else if (itemType === "labeling") {
        const targets = labelTargets.filter((t) => t.text.trim());
        const labels = labelChoices.filter((l) => l.text.trim());
        if (targets.length === 0 || labels.length === 0) { setFormError("Au moins une cible et une étiquette requises."); return; }
        const assignments: Record<string, string> = {};
        for (const t of targets) {
          if (labelAssignments[t.id]) assignments[t.id] = labelAssignments[t.id];
        }
        if (Object.keys(assignments).length < targets.length) { setFormError("Assignez une étiquette correcte à chaque cible."); return; }
        await createItemRevision({
          itemId: item.id,
          prompt: { text: promptText.trim(), targets, labels },
          correctAnswer: { assignments },
          scoringRules: { points: pts, partialCredit: labelPartialCredit },
          changelog: `Révision ${revisions.length + 1}`,
        });
      } else if (itemType === "passage") {
        await createItemRevision({
          itemId: item.id,
          prompt: { text: promptText.trim() },
          correctAnswer: null,
          scoringRules: {},
          changelog: `Révision ${revisions.length + 1}`,
        });
      } else {
        await createItemRevision({
          itemId: item.id,
          prompt: { text: promptText.trim(), instructions: "Réponse revue par un formateur." },
          correctAnswer: null,
          scoringRules: { points: pts },
          changelog: `Révision ${revisions.length + 1} · interaction riche`,
        });
      }
      // true_false and short_answer branches return via this shared tail;
      // single_choice/mcq already updated state and returned above.
      const refreshed = await listItemRevisions(item.id);
      setRevisions(refreshed);
      resetForm();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <form onSubmit={handleCreate} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`prompt-${item.id}`}>Énoncé</label>
          <Input id={`prompt-${item.id}`} value={promptText} onChange={(e) => setPromptText(e.target.value)} required />
        </div>

        {itemType === "true_false" && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="tf" checked={tfCorrect === "true"} onChange={() => setTfCorrect("true")} /> Vrai
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="tf" checked={tfCorrect === "false"} onChange={() => setTfCorrect("false")} /> Faux
            </label>
          </div>
        )}

        {(itemType === "single_choice" || itemType === "mcq") && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Options — {itemType === "single_choice" ? "une seule correcte" : "une ou plusieurs correctes"}</p>
            <OptionsEditor
              options={options} onChange={setOptions}
              mode={itemType === "single_choice" ? "single" : "multi"}
              correctIds={correctIds} onCorrectChange={setCorrectIds}
            />
            {itemType === "mcq" && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={partialCredit} onChange={(e) => setPartialCredit(e.target.checked)} /> Crédit partiel
                </label>
                {partialCredit && (
                  <div className="flex items-center gap-1.5">
                    <label htmlFor={`penalty-${item.id}`}>Pénalité / option fausse</label>
                    <Input id={`penalty-${item.id}`} type="number" min={0} step="0.1" value={penaltyPerWrong} onChange={(e) => setPenaltyPerWrong(e.target.value)} className="w-20" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {itemType === "short_answer" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Réponses acceptées (équivalentes)</p>
            {equivalents.map((val, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={val}
                  onChange={(e) => setEquivalents((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                  placeholder={`Réponse acceptée ${index + 1}`}
                  className="flex-1"
                />
                {equivalents.length > 1 && (
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer" onClick={() => setEquivalents((prev) => prev.filter((_, i) => i !== index))}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEquivalents((prev) => [...prev, ""])}><Plus size={14} /> Ajouter une réponse acceptée</Button>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Sensible à la casse
              </label>
            </div>
          </div>
        )}

        {itemType === "labeling" && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Cibles à étiqueter — sans canvas, choix au clavier (accessibilité ASM-021)
            </p>
            {labelTargets.map((t, index) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2">
                <Input
                  value={t.text}
                  onChange={(e) => setLabelTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))}
                  placeholder={`Cible ${index + 1} (ex. Capitale de la France)`}
                  className="flex-1 min-w-[200px]"
                />
                <select
                  value={labelAssignments[t.id] ?? ""}
                  onChange={(e) => setLabelAssignments((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  className="h-9 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
                  aria-label={`Étiquette correcte pour la cible ${index + 1}`}
                >
                  <option value="">Étiquette correcte…</option>
                  {labelChoices.filter((l) => l.text.trim()).map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
                </select>
                {labelTargets.length > 1 && (
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer la cible" onClick={() => setLabelTargets((prev) => prev.filter((x) => x.id !== t.id))}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLabelTargets((prev) => [...prev, { id: crypto.randomUUID(), text: "" }])}><Plus size={14} /> Ajouter une cible</Button>

            <p className="text-xs font-medium text-muted-foreground">Étiquettes disponibles</p>
            {labelChoices.map((l, index) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input
                  value={l.text}
                  onChange={(e) => setLabelChoices((prev) => prev.map((x) => (x.id === l.id ? { ...x, text: e.target.value } : x)))}
                  placeholder={`Étiquette ${index + 1}`}
                  className="flex-1"
                />
                {labelChoices.length > 1 && (
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Retirer l'étiquette" onClick={() => setLabelChoices((prev) => prev.filter((x) => x.id !== l.id))}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setLabelChoices((prev) => [...prev, { id: crypto.randomUUID(), text: "" }])}><Plus size={14} /> Ajouter une étiquette</Button>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={labelPartialCredit} onChange={(e) => setLabelPartialCredit(e.target.checked)} /> Crédit partiel (proportionnel aux cibles correctes)
              </label>
            </div>
          </div>
        )}

        {itemType === "passage" && (
          <p className="text-xs text-muted-foreground">
            Ce texte sera proposé comme stimulus à copier dans le prompt d'autres items (ASM-017) — pas noté, jamais attaché directement à une évaluation.
          </p>
        )}

        <div className="flex items-end gap-3">
          <div className="w-24 space-y-1">
            <label className="text-sm font-medium" htmlFor={`points-${item.id}`}>Points</label>
            <Input id={`points-${item.id}`} type="number" min={0.1} step="0.1" value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <Button type="submit" size="sm" loading={saving}><Plus /> Nouvelle révision</Button>
        </div>
        {formError && <p className="text-sm" style={{ color: "var(--ap-danger)" }}>{formError}</p>}
      </form>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune révision.</p>
      ) : (
        <ul className="space-y-1">
          {revisions.map((r) => (
            <li key={r.id} className="text-sm rounded border px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span>v{r.version} · {r.prompt.text}{r.prompt.options ? ` (${r.prompt.options.length} options)` : ""}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSimulatingId((cur) => (cur === r.id ? null : r.id))}>
                    <FlaskConical size={14} /> Simuler
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void inspectRescore(r.id)}>Prévisualiser le rescore</Button>
                </div>
              </div>
              {simulatingId === r.id && <SimulateForm item={item} revision={r} />}
              {impact[r.id] !== undefined && <div className="mt-2 rounded-md border border-dashed p-3 text-sm"><strong>{impact[r.id]} tentative(s) impactée(s)</strong><div className="mt-2 flex flex-wrap items-end gap-2"><div className="min-w-[260px] flex-1 space-y-1"><label className="text-xs" htmlFor={`rescore-reason-${r.id}`}>Motif audité</label><Input id={`rescore-reason-${r.id}`} value={rescoreReason} onChange={(e) => setRescoreReason(e.target.value)} placeholder="Ex. correction de la réponse correcte" /></div><Button size="sm" loading={executingRescore} disabled={!rescoreReason.trim()} onClick={() => void runRescore(r.id)}>Exécuter le rescore</Button></div></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachItemForm({ sectionId, items, onAttached }: { sectionId: string; items: AssessmentItem[]; onAttached: () => void }) {
  const scorableItems = items.filter((i) => (AUTHORABLE_TYPES as readonly string[]).includes(i.item_type) && i.item_type !== "passage");
  const [itemId, setItemId] = useState("");
  const [revisions, setRevisions] = useState<ItemRevision[]>([]);
  const [revisionId, setRevisionId] = useState("");
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (!itemId) { setRevisions([]); setRevisionId(""); return; }
    setLoadingRevisions(true);
    listItemRevisions(itemId)
      .then((revs) => { setRevisions(revs); setRevisionId(revs[0]?.id ?? ""); })
      .catch(showError)
      .finally(() => setLoadingRevisions(false));
  }, [itemId]);

  const handleAttach = async () => {
    if (!revisionId) return;
    setAttaching(true);
    try {
      await addItemRef(sectionId, revisionId, 0);
      onAttached();
      setItemId(""); setRevisionId("");
    } catch (err) {
      showError(err);
    } finally {
      setAttaching(false);
    }
  };

  if (scorableItems.length === 0) {
    return <p className="text-xs text-muted-foreground">Créez d'abord un item avec une révision.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Choisir un item">
        <option value="">Choisir un item…</option>
        {scorableItems.map((i) => <option key={i.id} value={i.id}>{i.item_type} · {i.id.slice(0, 8)}</option>)}
      </select>
      {itemId && (
        loadingRevisions ? <span className="text-xs text-muted-foreground">Chargement…</span> : (
          <select value={revisionId} onChange={(e) => setRevisionId(e.target.value)} className="h-9 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm" aria-label="Choisir une révision">
            {revisions.length === 0 && <option value="">Aucune révision</option>}
            {revisions.map((r) => <option key={r.id} value={r.id}>v{r.version} · {r.prompt.text.slice(0, 40)}</option>)}
          </select>
        )
      )}
      <Button size="sm" variant="outline" disabled={!revisionId} loading={attaching} onClick={handleAttach}><Plus size={14} /> Attacher</Button>
    </div>
  );
}

function AssessmentSectionRow({ section, items }: { section: AssessmentSection; items: AssessmentItem[] }) {
  const [refs, setRefs] = useState<AssessmentItemRef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listSectionItemRefs(section.id).then(setRefs).catch(showError).finally(() => setLoading(false));
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm font-medium">{section.title} <span className="text-muted-foreground font-normal">— {section.selection_mode === "pool" ? "tirage aléatoire" : "fixe"}</span></p>
      {loading ? <ListSkeleton rows={1} withAvatar={false} /> : (
        <p className="text-xs text-muted-foreground">{refs.length} item{refs.length !== 1 ? "s" : ""} attaché{refs.length !== 1 ? "s" : ""}</p>
      )}
      {section.selection_mode === "fixed" ? <AttachItemForm sectionId={section.id} items={items} onAttached={reload} /> : <PoolRuleForm sectionId={section.id} />}
    </div>
  );
}

function PoolRuleForm({ sectionId }: { sectionId: string }) {
  const [collectionId, setCollectionId] = useState("");
  const [count, setCount] = useState("5");
  const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!collectionId.trim() || Number(count) < 1) return;
    setSaving(true);
    try { await addPoolRule(sectionId, collectionId.trim(), Number(count)); setCollectionId(""); }
    catch (err) { showError(err); }
    finally { setSaving(false); }
  };
  return <div className="flex flex-wrap items-end gap-2"><div className="space-y-1"><label className="text-xs" htmlFor={`pool-collection-${sectionId}`}>UUID collection</label><Input id={`pool-collection-${sectionId}`} value={collectionId} onChange={(e) => setCollectionId(e.target.value)} placeholder="Collection d'items" className="min-w-[240px]" /></div><div className="space-y-1"><label className="text-xs" htmlFor={`pool-count-${sectionId}`}>Nombre tiré</label><Input id={`pool-count-${sectionId}`} type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} className="w-24" /></div><Button size="sm" variant="outline" loading={saving} onClick={() => void handleAdd()}><Plus size={14} /> Ajouter la règle</Button></div>;
}

const EMPTY_THRESHOLD: PlacementThreshold = { min_percentage: 0, max_percentage: 100, outcome: "recommend" };

/** ADP-009/010/011: score-range outcomes for this assessment used as a
 *  placement test — recommend/impose assign a remediation devoir
 *  (assignment_targets, already built), exempt sets a new 'exempted'
 *  release_state effect with an audited proof row
 *  (release_state_exemptions). Evaluated automatically on attempt submit,
 *  nothing to trigger from here — this panel only edits the thresholds. */
function PlacementThresholdsPanel({ assessment }: { assessment: Assessment }) {
  const [thresholds, setThresholds] = useState<PlacementThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlacementThresholds(assessment.id).then((t) => setThresholds(t.length > 0 ? t : [EMPTY_THRESHOLD])).catch(showError).finally(() => setLoading(false));
  }, [assessment.id]);

  const updateRow = (index: number, patch: Partial<PlacementThreshold>) => {
    setThresholds((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };
  const removeRow = (index: number) => setThresholds((prev) => prev.filter((_, i) => i !== index));
  const addRow = () => setThresholds((prev) => [...prev, EMPTY_THRESHOLD]);

  const handlePublish = async () => {
    setSaving(true);
    try {
      await publishPlacementThresholds(assessment.id, thresholds);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ListSkeleton rows={1} withAvatar={false} />;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Résultat de tentative → recommander/imposer une remédiation (devoir) ou dispenser une étape (exemption auditée). Évalué automatiquement à la soumission.</p>
      {thresholds.map((t, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
          <div className="space-y-1">
            <label className="text-xs" htmlFor={`th-min-${assessment.id}-${i}`}>Min %</label>
            <Input id={`th-min-${assessment.id}-${i}`} type="number" min={0} max={100} value={t.min_percentage} onChange={(e) => updateRow(i, { min_percentage: Number(e.target.value) })} className="w-20" />
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor={`th-max-${assessment.id}-${i}`}>Max %</label>
            <Input id={`th-max-${assessment.id}-${i}`} type="number" min={0} max={100} value={t.max_percentage} onChange={(e) => updateRow(i, { max_percentage: Number(e.target.value) })} className="w-20" />
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor={`th-outcome-${assessment.id}-${i}`}>Résultat</label>
            <select
              id={`th-outcome-${assessment.id}-${i}`}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={t.outcome}
              onChange={(e) => updateRow(i, { outcome: e.target.value as PlacementThreshold["outcome"] })}
            >
              <option value="recommend">Recommander</option>
              <option value="impose">Imposer</option>
              <option value="exempt">Dispenser (exemption)</option>
            </select>
          </div>
          {(t.outcome === "recommend" || t.outcome === "impose") && (
            <div className="space-y-1">
              <label className="text-xs" htmlFor={`th-remediation-${assessment.id}-${i}`}>UUID devoir de remédiation</label>
              <Input id={`th-remediation-${assessment.id}-${i}`} value={t.remediation_assignment_id ?? ""} onChange={(e) => updateRow(i, { remediation_assignment_id: e.target.value })} className="min-w-[220px]" />
            </div>
          )}
          {t.outcome === "exempt" && (
            <>
              <div className="space-y-1">
                <label className="text-xs" htmlFor={`th-target-type-${assessment.id}-${i}`}>Type de cible</label>
                <Input id={`th-target-type-${assessment.id}-${i}`} placeholder="ex. assignment" value={t.exempt_target_type ?? ""} onChange={(e) => updateRow(i, { exempt_target_type: e.target.value })} className="w-32" />
              </div>
              <div className="space-y-1">
                <label className="text-xs" htmlFor={`th-target-id-${assessment.id}-${i}`}>UUID cible</label>
                <Input id={`th-target-id-${assessment.id}-${i}`} value={t.exempt_target_id ?? ""} onChange={(e) => updateRow(i, { exempt_target_id: e.target.value })} className="min-w-[220px]" />
              </div>
            </>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>Retirer</Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus size={14} /> Ajouter un seuil</Button>
        <Button size="sm" loading={saving} onClick={handlePublish}>Publier les seuils</Button>
      </div>
    </div>
  );
}

function AssessmentRow({ assessment, items }: { assessment: Assessment; items: AssessmentItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("Section 1");
  const [poolMode, setPoolMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(assessment.status);
  const [publishedVersion, setPublishedVersion] = useState(assessment.published_version);

  const reload = () => {
    setLoading(true);
    listAssessmentSections(assessment.id).then(setSections).catch(showError).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (expanded) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handleAddSection = async () => {
    if (!sectionTitle.trim()) return;
    setAddingSection(true);
    try {
      if (poolMode) await addPoolSection(assessment.id, sectionTitle.trim(), sections.length);
      else await addFixedSection(assessment.id, sectionTitle.trim(), sections.length);
      setSectionTitle(`Section ${sections.length + 2}`);
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setAddingSection(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const updated = await publishAssessment(assessment.id);
      setStatus(updated.status);
      setPublishedVersion(updated.published_version);
    } catch (err) {
      showError(err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{assessment.title}</p>
          <p className="text-sm text-muted-foreground">{status === "published" ? `Publiée (v${publishedVersion})` : "Brouillon"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" loading={publishing} onClick={handlePublish}>{status === "published" ? "Republier" : "Publier"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>{expanded ? "Fermer" : "Gérer"}</Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-3">
          {loading ? <ListSkeleton rows={2} withAvatar={false} /> : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune section — ajoutez-en une pour pouvoir attacher des items.</p>
          ) : (
            <ul className="space-y-2" aria-label="Sections">
              {sections.map((s) => <li key={s.id}><AssessmentSectionRow section={s} items={items} /></li>)}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <Input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} className="w-48" aria-label="Titre de la nouvelle section" />
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={poolMode} onChange={(e) => setPoolMode(e.target.checked)} /> Tirage aléatoire</label>
            <Button size="sm" variant="outline" loading={addingSection} onClick={handleAddSection}><Plus size={14} /> Ajouter une section</Button>
          </div>
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Test de positionnement — seuils de remédiation/exemption</h4>
            <PlacementThresholdsPanel assessment={assessment} />
          </div>
        </div>
      )}
    </li>
  );
}

function AssessmentsPanel({ orgId, items }: { orgId: string; items: AssessmentItem[] }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listOrgAssessments(orgId).then(setAssessments).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const a = await createAssessment(orgId, title.trim());
      setAssessments((prev) => [a, ...prev]);
      setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Évaluations</h2><p>Sections fixes ou tirage aléatoire depuis une collection partagée.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="assessment-title">Titre</label>
          <Input id="assessment-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Créer</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune évaluation.</p>
      ) : (
        <ul className="space-y-2" aria-label="Évaluations">
          {assessments.map((a) => <AssessmentRow key={a.id} assessment={a} items={items} />)}
        </ul>
      )}
    </section>
  );
}

function CollectionsPanel({ orgId, items }: { orgId: string; items: AssessmentItem[] }) {
  const [collections, setCollections] = useState<ItemCollection[]>([]);
  const [selected, setSelected] = useState<ItemCollection | null>(null);
  const [permissions, setPermissions] = useState<ItemPermission[]>([]);
  const [members, setMembers] = useState<ItemCollectionMember[]>([]);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<ItemCollection['visibility']>("private");
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<ItemPermission['permission']>("view");
  const [memberItemId, setMemberItemId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const reload = () => listItemCollections(orgId).then(setCollections).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [orgId]);
  useEffect(() => {
    if (!selected) return;
    listItemPermissions(selected.id).then(setPermissions).catch(showError);
    listCollectionMembers(selected.id).then(setMembers).catch(showError);
  }, [selected]);
  const create = async () => {
    if (!title.trim()) return;
    setSaving(true); try { const collection = await createItemCollection(orgId, title.trim(), visibility); setCollections((prev) => [collection, ...prev]); setTitle(""); setSelected(collection); } catch (err) { showError(err); } finally { setSaving(false); }
  };
  const grant = async () => {
    if (!selected || !userId.trim()) return;
    setSaving(true); try { const row = await grantItemPermission(selected.id, userId.trim(), permission); setPermissions((prev) => [...prev.filter((p) => p.id !== row.id), row]); setUserId(""); } catch (err) { showError(err); } finally { setSaving(false); }
  };
  const addMember = async () => {
    if (!selected || !memberItemId) return;
    setSaving(true); try { const row = await addCollectionMember(selected.id, memberItemId, members.length); setMembers((prev) => [...prev, row]); setMemberItemId(""); } catch (err) { showError(err); } finally { setSaving(false); }
  };
  if (loading) return <TableSkeleton rows={2} cols={2} />;
  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Collections et permissions</h2><p>Partagez une banque d'items avec des droits explicites : voir, utiliser, commenter ou modifier.</p></div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de la collection" className="min-w-[220px]" />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as ItemCollection['visibility'])} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="private">Privée</option>
          <option value="shared">Partagée</option>
          <option value="org">Organisation</option>
        </select>
        <Button size="sm" loading={saving} onClick={() => void create()}><Plus size={14} /> Créer</Button>
      </div>
      {collections.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {collections.map((collection) => (
            <Button key={collection.id} size="sm" variant={selected?.id === collection.id ? "default" : "outline"} onClick={() => setSelected(collection)}>
              {collection.title} · {collection.visibility}
            </Button>
          ))}
        </div>
      )}
      {selected && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Droits de « {selected.title} »</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="UUID utilisateur" className="min-w-[200px]" />
              <select value={permission} onChange={(e) => setPermission(e.target.value as ItemPermission['permission'])} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="view">Voir</option>
                <option value="use">Utiliser</option>
                <option value="comment">Commenter</option>
                <option value="edit">Modifier</option>
              </select>
              <Button size="sm" variant="outline" loading={saving} onClick={() => void grant()}>Accorder</Button>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {permissions.map((row) => (
                <li className="flex items-center justify-between border-t py-2" key={row.id}>
                  <span>{row.user_id.slice(0, 8)} · {row.permission}</span>
                  <Button size="sm" variant="ghost" onClick={() => void revokeItemPermission(row.id).then(() => setPermissions((prev) => prev.filter((p) => p.id !== row.id))).catch(showError)}>Révoquer</Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Items de « {selected.title} »</p>
            <div className="flex flex-wrap items-end gap-2">
              <select value={memberItemId} onChange={(e) => setMemberItemId(e.target.value)} className="h-10 min-w-[200px] rounded-md border border-input bg-background px-2 text-sm" aria-label="Ajouter un item">
                <option value="">Choisir un item…</option>
                {items.filter((i) => !members.some((m) => m.item_id === i.id)).map((i) => <option key={i.id} value={i.id}>{i.item_type} · {i.id.slice(0, 8)}</option>)}
              </select>
              <Button size="sm" variant="outline" loading={saving} onClick={() => void addMember()}><Plus size={14} /> Ajouter</Button>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {members.map((m) => {
                const memberItem = items.find((i) => i.id === m.item_id);
                return (
                  <li className="flex items-center justify-between border-t py-2" key={m.id}>
                    <span>{memberItem ? `${memberItem.item_type} · ${memberItem.id.slice(0, 8)}` : m.item_id.slice(0, 8)}</span>
                    <Button size="sm" variant="ghost" onClick={() => void removeCollectionMember(m.id).then(() => setMembers((prev) => prev.filter((x) => x.id !== m.id))).catch(showError)}>Retirer</Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/** ASM-015/019/023 : file de révision manuelle — les réponses audio_video/
 *  file (jamais notées automatiquement) atterrissent ici, avec le fichier
 *  téléchargeable et un champ points/note qui écrit via
 *  grade_assessment_response() (recompute immédiat si la tentative est déjà
 *  soumise — voir la migration). */
function PendingReviewPanel({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<PendingReviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [grading, setGrading] = useState<string | null>(null);

  const reload = () => listPendingReviewResponses(orgId).then(setRows).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [orgId]);

  const loadFile = async (responseId: string) => {
    try {
      const files = await listResponseFiles(responseId);
      if (files[0]) setFileUrls((prev) => ({ ...prev, [responseId]: files[0].file_name }));
      const url = files[0] ? await getResponseFileSignedUrl(files[0].storage_path) : null;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) { showError(err); }
  };

  const grade = async (row: PendingReviewResponse) => {
    const pts = Number(points[row.id]);
    if (!Number.isFinite(pts) || pts < 0) return;
    setGrading(row.id);
    try {
      await gradeAssessmentResponse(row.id, pts, pts >= row.max_points, notes[row.id]);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) { showError(err); }
    finally { setGrading(null); }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;
  if (rows.length === 0) return null;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>À corriger manuellement</h2><p>Réponses audio/vidéo et fichier — sans comparateur automatique (ASM-015).</p></div>
      </div>
      <ul className="space-y-2" aria-label="Réponses en attente de correction">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border p-3 space-y-2">
            <p className="text-sm">{row.prompt.text} <span className="text-muted-foreground">({row.item_type} · {row.assessment_title})</span></p>
            {(row.item_type === "audio_video" || row.item_type === "file") && (
              <Button type="button" variant="outline" size="sm" onClick={() => void loadFile(row.id)}>
                {fileUrls[row.id] ?? "Ouvrir la pièce jointe"}
              </Button>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-24 space-y-1">
                <label className="text-xs" htmlFor={`grade-points-${row.id}`}>Points (/{row.max_points})</label>
                <Input id={`grade-points-${row.id}`} type="number" min={0} max={row.max_points} step="0.1" value={points[row.id] ?? ""} onChange={(e) => setPoints((prev) => ({ ...prev, [row.id]: e.target.value }))} />
              </div>
              <div className="min-w-[220px] flex-1 space-y-1">
                <label className="text-xs" htmlFor={`grade-note-${row.id}`}>Note (facultative)</label>
                <Input id={`grade-note-${row.id}`} value={notes[row.id] ?? ""} onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))} />
              </div>
              <Button size="sm" loading={grading === row.id} disabled={points[row.id] === undefined || points[row.id] === ""} onClick={() => void grade(row)}>Noter</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LmsItemBank() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemType, setItemType] = useState("mcq");
  const [creating, setCreating] = useState(false);
  const [legacyContentId, setLegacyContentId] = useState("");
  const [importingLegacy, setImportingLegacy] = useState(false);
  useSEO({ title: "Banque d'items", description: "Items versionnés, réutilisables et analysables." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    listOrgItems(activeOrgId).then(setItems).catch(showError).finally(() => setItemsLoading(false));
  }, [activeOrgId]);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setCreating(true);
    try {
      const item = await createItem(activeOrgId, itemType);
      setItems((prev) => [item, ...prev]);
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleLegacyImport = async () => {
    if (!legacyContentId.trim()) return;
    setImportingLegacy(true);
    try { const id = await importLegacyQuizAsAssessment(legacyContentId.trim()); setLegacyContentId(""); window.alert(`Évaluation importée : ${id}`); }
    catch (err) { showError(err); }
    finally { setImportingLegacy(false); }
  };

  if (loading) {
    return (
      <AppLayout subtitle="Banque d'items">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isStaff || !activeOrgId) {
    return (
      <AppLayout subtitle="Banque d'items">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Cette vue est réservée aux formateurs, responsables et administrateurs.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Banque d'items">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Banque d'items versionnée"
          description="Corriger un item publié crée une révision — les tentatives passées ne sont jamais modifiées."
          action={<Button variant="outline" asChild><Link to="/lms/assessments"><ClipboardList size={16} /> Passer une évaluation</Link></Button>}
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Items</h2><p>Réponses correctes conservées côté serveur uniquement.</p></div>
          </div>
          <form onSubmit={handleCreateItem} className="flex flex-wrap items-end gap-2 mb-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="item-type">Type</label>
              <select id="item-type" value={itemType} onChange={(e) => setItemType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="mcq">QCM</option>
                <option value="single_choice">Choix unique</option>
                <option value="true_false">Vrai/Faux</option>
                <option value="short_answer">Réponse courte</option>
                <option value="ranking">Classement</option>
                <option value="matching">Association</option>
                <option value="cloze">Texte à trous</option>
                <option value="passage">Passage (stimulus partagé)</option>
                <option value="interactive_video">Vidéo interactive</option>
                <option value="audio_video">Audio / vidéo (revue)</option>
                <option value="drawing">Dessin (revue)</option>
                <option value="labeling">Étiquetage</option>
                <option value="math_graph">Maths / graphique (revue)</option>
                <option value="file">Fichier (revue)</option>
                <option value="code">Code (revue)</option>
              </select>
            </div>
            <Button type="submit" size="sm" loading={creating}><Plus /> Créer un item</Button>
          </form>
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
            <div className="flex-1 space-y-1"><label className="text-xs font-medium" htmlFor="legacy-quiz-id">Importer un ancien quiz</label><Input id="legacy-quiz-id" value={legacyContentId} onChange={(e) => setLegacyContentId(e.target.value)} placeholder="UUID du contenu quiz" /></div>
            <Button type="button" variant="outline" size="sm" loading={importingLegacy} disabled={!legacyContentId.trim()} onClick={() => void handleLegacyImport()}>Importer en évaluation</Button>
          </div>

          {itemsLoading ? <TableSkeleton rows={3} cols={2} /> : items.length === 0 ? (
            <ExplorerEmptyState icon={<Layers size={27} />} title="Banque vide" body="Créez un item puis ajoutez sa première révision avec l'énoncé et la réponse correcte." />
          ) : (
            <ul className="space-y-2" aria-label="Items">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.item_type} · {item.status}</span>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}>
                      {expanded === item.id ? "Fermer" : "Révisions"}
                    </Button>
                  </div>
                  {expanded === item.id && <ItemRevisions item={item} />}
                </li>
              ))}
            </ul>
          )}
        </section>
        <PendingReviewPanel orgId={activeOrgId} />
        <CollectionsPanel orgId={activeOrgId} items={items} />
        <AssessmentsPanel orgId={activeOrgId} items={items} />
      </div>
    </AppLayout>
  );
}
