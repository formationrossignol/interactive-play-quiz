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

function RuleSets({ orgId }: { orgId: string }) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState("");
  const [prereqId, setPrereqId] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

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
    const dep = prereqId[ruleSet.id];
    if (!dep) return;
    try {
      await publishRuleSetVersion(ruleSet.id, { source: "activity_completed", target_id: dep });
      setRuleSets((prev) => prev.map((r) => (r.id === ruleSet.id ? { ...r, status: "published", published_version: r.published_version + 1 } : r)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Conditions de déblocage</h2><p>« Quand [activité terminée], alors débloquer [cette activité] ». Les règles cycliques sont refusées à la publication.</p></div>
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
          {ruleSets.map((rs) => (
            <li key={rs.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Activité {rs.target_id.slice(0, 8)} · {rs.status}</span>
                <span className="text-muted-foreground">v{rs.published_version}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="UUID de l'activité prérequise"
                  value={prereqId[rs.id] ?? ""}
                  onChange={(e) => setPrereqId((prev) => ({ ...prev, [rs.id]: e.target.value }))}
                />
                <Button variant="ghost" size="sm" onClick={() => handlePublish(rs)}>Publier</Button>
              </div>
            </li>
          ))}
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
