import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useSubscribers } from "@/lib/pages/adminHooks";
import { DataTable } from "@/components/ui/data-table";
import type { SubscriberRow } from "@/lib/pages/types";

const columns: ColumnDef<SubscriberRow>[] = [
  {
    accessorKey: "user_id",
    header: "Utilisateur",
    cell: ({ getValue }) => <span className="adm-mono">{(getValue() as string).slice(0, 8)}…</span>,
  },
  {
    accessorKey: "created_at",
    header: "Abonné le",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("fr-FR"),
  },
];

export const SubscribersTab = () => {
  const { data, isLoading } = useSubscribers();
  const rows = useMemo(() => data ?? [], [data]);
  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <h3>💌 Abonnés au changelog <span className="adm-tag">{isLoading ? "…" : rows.length}</span></h3>
      </div>
      {rows.length === 0 && !isLoading ? (
        <div className="adm-empty"><span className="e-emo">📭</span>Aucun abonné pour le moment.</div>
      ) : (
        <DataTable columns={columns} data={rows} emptyMessage="Aucun abonné pour le moment." />
      )}
    </div>
  );
};
