import { useSubscribers } from "@/lib/pages/adminHooks";

export const SubscribersTab = () => {
  const { data, isLoading } = useSubscribers();
  const rows = data ?? [];
  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <h3>💌 Abonnés au changelog <span className="adm-tag">{isLoading ? "…" : rows.length}</span></h3>
      </div>
      {rows.length === 0 && !isLoading ? (
        <div className="adm-empty"><span className="e-emo">📭</span>Aucun abonné pour le moment.</div>
      ) : (
        <table className="adm-tbl">
          <thead><tr><th>Utilisateur</th><th>Abonné le</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.user_id}>
                <td><span className="adm-mono">{s.user_id.slice(0, 8)}…</span></td>
                <td>{new Date(s.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
