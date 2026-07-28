import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, Inbox } from "lucide-react";
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
        <h3><Mail className="h-4 w-4" style={{ display: "inline", verticalAlign: "-3px" }} /> Abonnés au changelog <span className="adm-tag">{isLoading ? "…" : rows.length}</span></h3>
      </div>
      {rows.length === 0 && !isLoading ? (
        <div className="adm-empty"><span className="e-emo"><Inbox style={{ width: 30, height: 30 }} /></span>Aucun abonné pour le moment.</div>
      ) : (
        <DataTable columns={columns} data={rows} emptyMessage="Aucun abonné pour le moment." />
      )}
    </div>
  );
};
