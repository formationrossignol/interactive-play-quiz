import { useEffect, useState } from "react";
import { GitBranch, Plus, Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  createAutomationRule,
  createRuleSet,
  listOrgAutomationRules,
  listOrgRuleSets,
  publishRuleSetVersion,
  type AutomationRule,
  type RuleSet,
} from "@/lib/lms/automation";

const STAFF_ROLES = new Set(["pedago", "admin"]);

const triggerLabel: Record<string, string> = {
  enrollment: "Inscription",
  due_soon: "Échéance proche",
  overdue: "Retard",
  inactivity: "Inactivité",
  completion: "Complétion",
  failure: "Échec",
  mastery_gained: "Maîtrise acquise",
  mastery_expired: "Maîtrise expirée",
};

type LeafKind = "activity_completed" | "date" | "score" | "competency";
type NodeOp = "and" | "or";
type DateOperator = "after" | "before";
/** Mirrors date's after/before pair — covers ADP-002's "supérieur/inférieur"
 *  without inventing "dans une plage" nobody asked the date evaluator for
 *  either (see 20260812210000_score_competency_rule_evaluators.sql). */
type ThresholdOperator = "gte" | "lte";

interface LeafDraft {
  kind: "leaf";
  id: string;
  leafKind: LeafKind;
  prereqId: string;
  dateOperator: DateOperator;
  dateValue: string;
  scoreTargetId: string;
  scoreOperator: ThresholdOperator;
  scoreValue: string;
  competencyTargetId: string;
  competencyOperator: ThresholdOperator;
  competencyLevelCode: string;
}

interface GroupDraft {
  kind: "group";
  id: string;
  op: NodeOp;
  children: ConditionDraft[];
}

type ConditionDraft = LeafDraft | GroupDraft;

function makeLeaf(): LeafDraft {
  return {
    kind: "leaf", id: crypto.randomUUID(), leafKind: "activity_completed", prereqId: "",
    dateOperator: "after", dateValue: "",
    scoreTargetId: "", scoreOperator: "gte", scoreValue: "",
    competencyTargetId: "", competencyOperator: "gte", competencyLevelCode: "",
  };
}

function makeRootDraft(): GroupDraft {
  return { kind: "group", id: crypto.randomUUID(), op: "and", children: [makeLeaf()] };
}

/** ADP-003: evaluate_rule_definition() already recurses on {op:'and'|'or',
 *  children:[...]} (20260811070000_release_state_engine.sql) and
 *  publish_rule_set_version() already enforces depth ≤6 + cycle detection
 *  (20260810200000_adaptive_automation.sql) — the DSL itself was never the
 *  gap, only this builder only ever emitting a single leaf. Root is always
 *  a group (even a single condition serializes as {op:'and',children:[…]})
 *  so there's no special-cased "convert a leaf to a group" affordance to
 *  build separately from "add another condition to this group". Returns
 *  null on an incomplete leaf so handlePublish can bail without guessing
 *  a default. */
function serializeCondition(node: ConditionDraft): Record<string, unknown> | null {
  if (node.kind === "group") {
    if (node.children.length === 0) return null;
    const children = node.children.map(serializeCondition);
    if (children.some((c) => c === null)) return null;
    return { op: node.op, children };
  }
  switch (node.leafKind) {
    case "activity_completed":
      if (!node.prereqId.trim()) return null;
      return { source: "activity_completed", target_id: node.prereqId.trim() };
    case "date":
      if (!node.dateValue) return null;
      return { source: "date", operator: node.dateOperator, value: new Date(node.dateValue).toISOString() };
    case "score":
      if (!node.scoreTargetId.trim() || !node.scoreValue) return null;
      return { source: "score", target_id: node.scoreTargetId.trim(), operator: node.scoreOperator, value: Number(node.scoreValue) };
    case "competency":
      if (!node.competencyTargetId.trim() || !node.competencyLevelCode.trim()) return null;
      return { source: "competency", target_id: node.competencyTargetId.trim(), operator: node.competencyOperator, value: node.competencyLevelCode.trim() };
  }
}

function ConditionNodeEditor({ node, onChange, onRemove, depth }: {
  node: ConditionDraft;
  onChange: (next: ConditionDraft) => void;
  onRemove?: () => void;
  depth: number;
}) {
  if (node.kind === "group") {
    const updateChild = (index: number, next: ConditionDraft) => {
      const children = [...node.children];
      children[index] = next;
      onChange({ ...node, children });
    };
    const removeChild = (index: number) => onChange({ ...node, children: node.children.filter((_, i) => i !== index) });

    return (
      <div className="rounded-md border p-2 space-y-2" style={{ borderStyle: "dashed" }}>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
            value={node.op}
            onChange={(e) => onChange({ ...node, op: e.target.value as NodeOp })}
            aria-label="Opérateur du groupe"
          >
            <option value="and">ET (toutes vraies)</option>
            <option value="or">OU (au moins une vraie)</option>
          </select>
          {onRemove && <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Retirer ce groupe</Button>}
        </div>
        <div className="space-y-2 pl-3" style={{ borderLeft: "2px solid var(--ap-line)" }}>
          {node.children.map((child, i) => (
            <ConditionNodeEditor
              key={child.id}
              node={child}
              onChange={(next) => updateChild(i, next)}
              onRemove={node.children.length > 1 ? () => removeChild(i) : undefined}
              depth={depth + 1}
            />
          ))}
        </div>
        {depth < 5 && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...node, children: [...node.children, makeLeaf()] })}>+ Condition</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...node, children: [...node.children, makeRootDraft()] })}>+ Sous-groupe</Button>
          </div>
        )}
      </div>
    );
  }

  const update = (patch: Partial<LeafDraft>) => onChange({ ...node, ...patch });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={node.leafKind}
        onChange={(e) => update({ leafKind: e.target.value as LeafKind })}
        aria-label="Type de condition"
      >
        <option value="activity_completed">Activité terminée</option>
        <option value="date">Date atteinte</option>
        <option value="score">Note à un seuil</option>
        <option value="competency">Compétence à un niveau</option>
      </select>
      {node.leafKind === "activity_completed" && (
        <Input placeholder="UUID de l'activité prérequise" value={node.prereqId} onChange={(e) => update({ prereqId: e.target.value })} className="min-w-[200px]" />
      )}
      {node.leafKind === "date" && (
        <>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={node.dateOperator} onChange={(e) => update({ dateOperator: e.target.value as DateOperator })}>
            <option value="after">À partir du</option>
            <option value="before">Jusqu'au</option>
          </select>
          <input type="datetime-local" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={node.dateValue} onChange={(e) => update({ dateValue: e.target.value })} />
        </>
      )}
      {node.leafKind === "score" && (
        <>
          <Input placeholder="UUID de l'activité notée" value={node.scoreTargetId} onChange={(e) => update({ scoreTargetId: e.target.value })} className="min-w-[180px]" />
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={node.scoreOperator} onChange={(e) => update({ scoreOperator: e.target.value as ThresholdOperator })}>
            <option value="gte">Au moins</option>
            <option value="lte">Au plus</option>
          </select>
          <Input type="number" min={0} max={100} step="0.1" placeholder="%" value={node.scoreValue} onChange={(e) => update({ scoreValue: e.target.value })} className="w-24" />
        </>
      )}
      {node.leafKind === "competency" && (
        <>
          <Input placeholder="UUID de la compétence" value={node.competencyTargetId} onChange={(e) => update({ competencyTargetId: e.target.value })} className="min-w-[180px]" />
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={node.competencyOperator} onChange={(e) => update({ competencyOperator: e.target.value as ThresholdOperator })}>
            <option value="gte">Au moins le niveau</option>
            <option value="lte">Au plus le niveau</option>
          </select>
          <Input placeholder="Code du niveau" value={node.competencyLevelCode} onChange={(e) => update({ competencyLevelCode: e.target.value })} className="w-36" />
        </>
      )}
      {onRemove && <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Retirer</Button>}
    </div>
  );
}

function RuleSets({ orgId }: { orgId: string }) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ConditionDraft>>({});
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    listOrgRuleSets(orgId).then(setRuleSets).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) return;
    setCreating(true);
    try {
      const rs = await createRuleSet(orgId, "activity", targetId.trim());
      setRuleSets((prev) => [rs, ...prev]);
      setTargetId("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (ruleSet: RuleSet) => {
    const draft = drafts[ruleSet.id] ?? makeRootDraft();
    const definition = serializeCondition(draft);
    if (!definition) {
      setPublishError(ruleSet.id);
      return;
    }
    setPublishError(null);
    setPublishing(ruleSet.id);
    try {
      await publishRuleSetVersion(ruleSet.id, definition);
      setRuleSets((prev) => prev.map((r) => (r.id === ruleSet.id ? { ...r, status: "published", published_version: r.published_version + 1 } : r)));
    } catch (err) {
      showError(err);
    } finally {
      setPublishing(null);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Conditions de déblocage</h2><p>« Quand [conditions combinées en ET/OU], alors débloquer [cette activité] ». Groupes imbriqués jusqu'à profondeur 6 ; les règles cycliques sont refusées à la publication (ADP-003).</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[280px] space-y-1">
          <label className="text-sm font-medium" htmlFor="target-id">Identifiant de l'activité gouvernée (UUID)</label>
          <Input id="target-id" value={targetId} onChange={(e) => setTargetId(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Créer</Button>
      </form>
      {ruleSets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune règle créée.</p>
      ) : (
        <ul className="space-y-2">
          {ruleSets.map((rs) => {
            const draft = drafts[rs.id] ?? makeRootDraft();
            return (
              <li key={rs.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Activité {rs.target_id.slice(0, 8)} · {rs.status}</span>
                  <span className="text-muted-foreground">v{rs.published_version}</span>
                </div>
                <ConditionNodeEditor
                  node={draft}
                  onChange={(next) => setDrafts((prev) => ({ ...prev, [rs.id]: next }))}
                  depth={1}
                />
                {publishError === rs.id && <p className="text-sm" style={{ color: "var(--ap-danger)" }}>Complétez toutes les conditions (aucune ne peut rester vide) avant de publier.</p>}
                <Button variant="ghost" size="sm" loading={publishing === rs.id} onClick={() => void handlePublish(rs)}>Publier</Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AutomationRules({ orgId }: { orgId: string }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState("overdue");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listOrgAutomationRules(orgId).then(setRules).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const rule = await createAutomationRule(orgId, trigger);
      setRules((prev) => [rule, ...prev]);
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Automatisations</h2><p>Déclencheur → action. Chaque exécution est journalisée et rejouable sans doublon.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="trigger-type">Déclencheur</label>
          <select id="trigger-type" value={trigger} onChange={(e) => setTrigger(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {Object.entries(triggerLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <Button type="submit" size="sm" loading={creating}><Zap /> Créer</Button>
      </form>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune automatisation créée.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{triggerLabel[r.trigger_type] ?? r.trigger_type}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LmsAutomation() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Parcours adaptatifs", description: "Conditions de déblocage, remédiation et automatisations." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  if (loading) {
    return (
      <AppLayout subtitle="Parcours adaptatifs">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isStaff || !activeOrgId) {
    return (
      <AppLayout subtitle="Parcours adaptatifs">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Seuls les responsables pédagogiques et administrateurs configurent les règles.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Parcours adaptatifs">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Parcours adaptatifs et automatisations"
          description="Déblocages conditionnels, remédiation et relances automatiques."
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <GitBranch size={16} /> Le moteur d'évaluation est déterministe, idempotent et audité.
        </div>
        <RuleSets orgId={activeOrgId} />
        <AutomationRules orgId={activeOrgId} />
      </div>
    </AppLayout>
  );
}
