import { Euro, Users, TrendingUp, CircleAlert } from "lucide-react";
import { useAdminRevenue } from "@/lib/pages/adminHooks";
import { Skeleton } from "@/components/ui/skeleton";

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", entreprise: "Entreprise" };

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

export const RevenueTab = () => {
  const { data, isLoading, isError } = useAdminRevenue();

  if (isError) {
    return (
      <div className="adm-panel">
        <div className="adm-empty">
          <span className="e-emo"><CircleAlert style={{ width: 30, height: 30 }} /></span>
          Impossible de charger les données Stripe. Vérifiez que STRIPE_SECRET_KEY est configuré côté serveur.
        </div>
      </div>
    );
  }

  const planEntries = Object.entries(data?.planBreakdown ?? {}) as [string, number][];

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <h3><Euro className="h-4 w-4" style={{ display: "inline", verticalAlign: "-3px" }} /> Revenus</h3>
      </div>

      <div className="adm-kpi">
        <div className="adm-stat acc-brand">
          <div className="chip"><TrendingUp /></div>
          <div className="num">{isLoading ? <Skeleton className="h-8 w-24" /> : formatMoney(data?.mrr ?? 0, data?.currency ?? "eur")}</div>
          <div className="lbl">MRR (revenu mensuel récurrent)</div>
        </div>
        <div className="adm-stat acc-quiz">
          <div className="chip"><Users /></div>
          <div className="num">{isLoading ? <Skeleton className="h-8 w-16" /> : data?.activeSubscriptions ?? 0}</div>
          <div className="lbl">Abonnements Stripe actifs</div>
        </div>
        <div className="adm-stat acc-flash">
          <div className="chip"><Users /></div>
          <div className="num">{isLoading ? <Skeleton className="h-8 w-16" /> : data?.totalUsers ?? 0}</div>
          <div className="lbl">Comptes créés</div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <h4 style={{ marginBottom: 12 }}>Répartition par plan</h4>
        {isLoading ? (
          <div style={{ display: "flex", gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 flex-1 rounded-md" />)}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {planEntries.map(([plan, count]) => (
              <div
                key={plan}
                style={{
                  flex: "1 1 140px", background: "var(--ap-paper-2)", border: "2px solid var(--ap-line)",
                  borderRadius: "var(--ap-r-md)", padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900 }}>{count}</div>
                <div style={{ fontSize: 13, color: "var(--ap-muted)", fontWeight: 700 }}>{PLAN_LABEL[plan] ?? plan}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--ap-muted)" }}>
        Le MRR est calculé en direct depuis les abonnements Stripe actifs (mensualisé pour les plans annuels).
        La répartition par plan vient des comptes en base de données.
      </p>
    </div>
  );
};
