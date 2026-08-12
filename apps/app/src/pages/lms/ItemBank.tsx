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
  addItemRef,
  createAssessment,
  createItem,
  createItemRevision,
  listAssessmentSections,
  listItemRevisions,
  listOrgAssessments,
  listOrgItems,
  listSectionItemRefs,
  publishAssessment,
  simulateItemScoring,
  type Assessment,
  type AssessmentItem,
  type AssessmentItemRef,
  type AssessmentSection,
  type ItemOption,
  type ItemRevision,
  type SimulationResult,
} from "@/lib/lms/itemBank";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);
/** The only 4 item_types with a scoring comparator (see the correction
 *  engine migration's header) — the item-type select is intentionally
 *  limited to these, not the 21 the DB check constraint allows: creating
 *  an item of an unscored type would be authoring something no attempt
 *  could ever be scored on. */
const SCORABLE_TYPES = ["mcq", "single_choice", "true_false", "short_answer"] as const;
type ScorableType = (typeof SCORABLE_TYPES)[number];

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  useEffect(() => {
    listItemRevisions(item.id).then(setRevisions).catch(showError).finally(() => setLoading(false));
  }, [item.id]);

  const resetForm = () => {
    setPromptText(""); setPoints("1");
    setOptions([{ id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" }]);
    setCorrectIds([]); setPartialCredit(false); setPenaltyPerWrong("1");
    setTfCorrect("true"); setEquivalents([""]); setCaseSensitive(false);
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
      } else {
        const filled = equivalents.map((e2) => e2.trim()).filter(Boolean);
        if (filled.length === 0) { setFormError("Au moins une réponse acceptée requise."); return; }
        await createItemRevision({
          itemId: item.id, prompt: { text: promptText.trim() },
          correctAnswer: { equivalents: filled }, scoringRules: { points: pts, caseSensitive },
          changelog: `Révision ${revisions.length + 1}`,
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
                </div>
              </div>
              {simulatingId === r.id && <SimulateForm item={item} revision={r} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachItemForm({ sectionId, items, onAttached }: { sectionId: string; items: AssessmentItem[]; onAttached: () => void }) {
  const scorableItems = items.filter((i) => (SCORABLE_TYPES as readonly string[]).includes(i.item_type));
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
    return <p className="text-xs text-muted-foreground">Créez d'abord un item notable (QCM, choix unique, vrai/faux, réponse courte) avec au moins une révision.</p>;
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
      <p className="text-sm font-medium">{section.title} <span className="text-muted-foreground font-normal">— fixe</span></p>
      {loading ? <ListSkeleton rows={1} withAvatar={false} /> : (
        <p className="text-xs text-muted-foreground">{refs.length} item{refs.length !== 1 ? "s" : ""} attaché{refs.length !== 1 ? "s" : ""}</p>
      )}
      <AttachItemForm sectionId={section.id} items={items} onAttached={reload} />
    </div>
  );
}

function AssessmentRow({ assessment, items }: { assessment: Assessment; items: AssessmentItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("Section 1");
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
      await addFixedSection(assessment.id, sectionTitle.trim(), sections.length);
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
            <Button size="sm" variant="outline" loading={addingSection} onClick={handleAddSection}><Plus size={14} /> Ajouter une section fixe</Button>
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
        <div><h2>Évaluations</h2><p>Sections fixes uniquement — le tirage aléatoire (pool) n'a pas encore d'exécuteur.</p></div>
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

export default function LmsItemBank() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemType, setItemType] = useState("mcq");
  const [creating, setCreating] = useState(false);
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
              </select>
            </div>
            <Button type="submit" size="sm" loading={creating}><Plus /> Créer un item</Button>
          </form>

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
        <AssessmentsPanel orgId={activeOrgId} items={items} />
      </div>
    </AppLayout>
  );
}
