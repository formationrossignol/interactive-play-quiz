import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileBarChart, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { MaterialSymbol } from "@/components/MaterialSymbol";
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
import {
  getEnrollmentTotals,
  getMinCohortSize,
  listDailyActivity,
  listDailyCompetency,
  setMinCohortSize,
  type DailyActivityRow,
  type DailyCompetencyRow,
  type EnrollmentTotals,
} from "@/lib/lms/analyticsDashboard";

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

const formatDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

const activityChartConfig = {
  activeLearners: { label: "Apprenants actifs", color: "var(--mp-chart-primary)" },
  events: { label: "Événements", color: "var(--mp-chart-secondary)" },
} satisfies ChartConfig;

const competencyChartConfig = {
  evidenceCount: { label: "Preuves enregistrées", color: "var(--mp-chart-positive)" },
} satisfies ChartConfig;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** ANA-006/007/008: a single formateur/pédagogue/admin dashboard — the three
 *  roles share the same org-wide read access (RLS), so there is no distinct
 *  data behind separate screens today. ANA-005 (apprenant) is a real gap:
 *  see analyticsDashboard.ts — no learner-scoped RLS exists on these tables. */
function AnalyticsDashboard({ orgId }: { orgId: string }) {
  const [activity, setActivity] = useState<DailyActivityRow[]>([]);
  const [enrollmentTotals, setEnrollmentTotals] = useState<EnrollmentTotals | null>(null);
  const [competency, setCompetency] = useState<DailyCompetencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listDailyActivity(orgId, isoDaysAgo(14)),
      getEnrollmentTotals(orgId, isoDaysAgo(30)),
      listDailyCompetency(orgId, isoDaysAgo(14)),
    ])
      .then(([activityRows, enrollment, competencyRows]) => {
        if (cancelled) return;
        setActivity(activityRows);
        setEnrollmentTotals(enrollment);
        setCompetency(competencyRows);
      })
      .catch((err) => showError(err, "AnalyticsDashboard.load", "Impossible de charger les projections."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  const activityByDay = useMemo(() => {
    const byDay = new Map<string, { date: string; activeLearners: Set<string>; events: number }>();
    for (const row of activity) {
      const entry = byDay.get(row.day) ?? { date: row.day, activeLearners: new Set<string>(), events: 0 };
      entry.activeLearners.add(row.learner_id);
      entry.events += row.events_count;
      byDay.set(row.day, entry);
    }
    return [...byDay.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({ date: entry.date, activeLearners: entry.activeLearners.size, events: entry.events }));
  }, [activity]);

  const competencyByDay = useMemo(
    () => competency.map((row) => ({ date: row.day, evidenceCount: row.evidence_count })),
    [competency],
  );

  if (loading) return <TableSkeleton rows={3} cols={4} />;

  const hasActivity = activityByDay.some((point) => point.activeLearners > 0 || point.events > 0);
  const hasCompetency = competencyByDay.some((point) => point.evidenceCount > 0);

  return (
    <div className="space-y-4">
      {enrollmentTotals?.suppressed ? (
        <div className="ap-card p-4 text-sm">
          <strong className="block">Inscriptions (30j) — masquées</strong>
          <span className="ap-muted text-xs">
            Population sous le seuil de confidentialité configuré pour cette organisation — affichage suspendu pour éviter toute ré-identification indirecte.
          </span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Inscriptions démarrées (30j)", value: enrollmentTotals?.started_count ?? 0 },
            { label: "Terminées (30j)", value: enrollmentTotals?.completed_count ?? 0 },
            { label: "Désinscriptions (30j)", value: enrollmentTotals?.withdrawn_count ?? 0 },
            { label: "Mises en liste d'attente (30j)", value: enrollmentTotals?.waitlisted_count ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="ap-card p-4">
              <strong className="block text-xl">{stat.value}</strong>
              <span className="ap-muted text-xs">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="product-analytics-grid">
        <div className="product-analytics-card">
          <div className="product-analytics-card__header">
            <div>
              <h3>Activité sur 14 jours</h3>
              <p>Apprenants actifs et événements d'apprentissage, par jour.</p>
            </div>
          </div>
          {hasActivity ? (
            <ChartContainer config={activityChartConfig} className="aspect-auto h-[230px] w-full">
              <AreaChart data={activityByDay} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="lmsActivityLearnersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-activeLearners)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-activeLearners)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="lmsActivityEventsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-events)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--color-events)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="5 7" />
                <XAxis dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(payload[0]?.payload.date)} />} />
                <Area type="monotone" dataKey="activeLearners" stroke="var(--color-activeLearners)" strokeWidth={3} fill="url(#lmsActivityLearnersFill)" activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
                <Area type="monotone" dataKey="events" stroke="var(--color-events)" strokeWidth={3} fill="url(#lmsActivityEventsFill)" activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="product-empty-inline" style={{ minHeight: 220 }}>
              <div>
                <MaterialSymbol name="monitoring" size={25} />
                <strong>Aucune activité récente</strong>
                <span style={{ display: "block", fontSize: 12 }}>Alimenté par run_daily_analytics_rollup() — aucun run récent pour cette organisation.</span>
              </div>
            </div>
          )}
        </div>

        <div className="product-analytics-card">
          <div className="product-analytics-card__header">
            <div>
              <h3>Preuves de compétence</h3>
              <p>Preuves enregistrées par jour, toutes compétences confondues.</p>
            </div>
          </div>
          {hasCompetency ? (
            <ChartContainer config={competencyChartConfig} className="aspect-auto h-[230px] w-full">
              <BarChart data={competencyByDay} margin={{ left: 0, right: 8, top: 12, bottom: 0 }} barCategoryGap="38%">
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <XAxis dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(payload[0]?.payload.date)} />} />
                <Bar dataKey="evidenceCount" fill="var(--color-evidenceCount)" radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="product-empty-inline" style={{ minHeight: 220 }}>
              <div>
                <MaterialSymbol name="target" size={25} />
                <strong>Aucune preuve récente</strong>
                <span style={{ display: "block", fontSize: 12 }}>Les preuves de compétence enregistrées apparaîtront ici.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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

/** ANA-020: min_cohort_size gates every cohort-level aggregate below it
 *  (get_org_enrollment_totals/get_daily_competency_totals/get_daily_item_totals,
 *  20260812170000_analytics_privacy_threshold.sql) — pedago/admin only,
 *  mirrors risk_signal_settings' per-org configurability. */
function PrivacySettings({ orgId }: { orgId: string }) {
  const [minCohortSize, setMinCohortSizeState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    getMinCohortSize(orgId).then((n) => { setMinCohortSizeState(n); setDraft(String(n)); }).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1) return;
    setSaving(true);
    try {
      await setMinCohortSize(orgId, n);
      setMinCohortSizeState(n);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton rows={1} cols={2} />;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Confidentialité</h2><p>Taille minimale de cohorte avant affichage d'un agrégat (ANA-020) — sous ce seuil, la période est masquée plutôt qu'affichée avec un petit nombre.</p></div>
      </div>
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] space-y-1">
          <label className="text-sm font-medium" htmlFor="min-cohort-size">Taille minimale</label>
          <Input id="min-cohort-size" type="number" min={1} value={draft} onChange={(e) => setDraft(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}>Enregistrer</Button>
        {minCohortSize !== null && <span className="ap-muted text-xs">Actuel : {minCohortSize}</span>}
      </form>
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
  const isManager = memberships.some((m) => m.org_id === activeOrgId && (m.role === "pedago" || m.role === "admin"));

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
        <AnalyticsDashboard orgId={activeOrgId} />
        <RiskSignals orgId={activeOrgId} />
        <SavedReports orgId={activeOrgId} />
        {isManager && <PrivacySettings orgId={activeOrgId} />}
      </div>
    </AppLayout>
  );
}
