import { useEffect, useState } from "react";
import { AlertTriangle, FileBarChart, Plus } from "lucide-react";
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
  createSavedReport,
  listMySavedReports,
  listOrgRiskSignals,
  resolveRiskSignal,
  type RiskSignal,
  type SavedReport,
} from "@/lib/lms/analytics";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);

const ruleLabel: Record<string, string> = {
  inactivity: "Inactivité",
  overdue: "Retard",
  repeated_failure: "Échecs répétés",
  progress_drop: "Chute de progression",
  blocking_prereq: "Prérequis bloquant",
};

function RiskSignals({ orgId }: { orgId: string }) {
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    listOrgRiskSignals(orgId).then(setSignals).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await resolveRiskSignal(id, "Suivi effectué");
      setSignals((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      showError(err);
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={3} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Signaux de risque</h2><p>Fondés sur des règles, jamais une décision automatique — une action humaine est requise.</p></div>
      </div>
      {signals.length === 0 ? (
        <ExplorerEmptyState
          icon={<AlertTriangle size={27} />}
          title="Aucun signal ouvert"
          body="Les apprenants inactifs, en retard ou en échec répété apparaîtront ici avec leurs facteurs explicites."
        />
      ) : (
        <ul className="space-y-2" aria-label="Signaux de risque">
          {signals.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{ruleLabel[s.rule_code] ?? s.rule_code}</p>
                <p className="text-muted-foreground">Apprenant {s.learner_id.slice(0, 8)} · {s.window_start} → {s.window_end}</p>
              </div>
              <Button variant="ghost" size="sm" loading={resolving === s.id} onClick={() => handleResolve(s.id)}>Marquer traité</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedReports({ orgId }: { orgId: string }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listMySavedReports(orgId).then(setReports).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const report = await createSavedReport(orgId, title.trim(), []);
      setReports((prev) => [report, ...prev]);
      setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Rapports enregistrés</h2><p>Filtres et colonnes réutilisables, visibles selon leur audience.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="report-title">Titre</label>
          <Input id="report-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Enregistrer</Button>
      </form>
      {reports.length === 0 ? (
        <ExplorerEmptyState icon={<FileBarChart size={27} />} title="Aucun rapport" body="Enregistrez vos filtres favoris pour les retrouver et les programmer." />
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{r.title}</span>
              <span className="text-muted-foreground">{r.audience}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LmsAnalytics() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Analytics pédagogiques", description: "Mesures fiables et signaux de risque." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  if (loading) {
    return (
      <AppLayout subtitle="Analytics">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isStaff || !activeOrgId) {
    return (
      <AppLayout subtitle="Analytics">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Cette vue est réservée aux formateurs, responsables et administrateurs.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Analytics">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Analytics pédagogiques"
          description="Définitions partagées, signaux de risque explicables et rapports réutilisables."
        />
        <RiskSignals orgId={activeOrgId} />
        <SavedReports orgId={activeOrgId} />
      </div>
    </AppLayout>
  );
}
