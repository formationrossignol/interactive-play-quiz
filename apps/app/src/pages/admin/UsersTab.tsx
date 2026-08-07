import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Users, Inbox } from "lucide-react";
import { useAdminUsers } from "@/lib/pages/adminHooks";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import type { AdminUserRow } from "@/lib/pages/types";

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", entreprise: "Entreprise" };

function Badge({ children, tone }: { children: React.ReactNode; tone: "brand" | "muted" | "warn" }) {
  const colors = {
    brand: { color: "var(--ap-brand)", background: "var(--ap-brand-soft, rgba(112,72,255,.12))" },
    muted: { color: "var(--ap-muted)", background: "var(--ap-paper-2)" },
    warn: { color: "var(--ap-danger)", background: "rgba(255,90,77,.12)" },
  }[tone];
  return (
    <span style={{ ...colors, fontWeight: 800, fontSize: 12, padding: "3px 10px", borderRadius: "var(--ap-r-sm)", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const columns: ColumnDef<AdminUserRow>[] = [
  {
    accessorKey: "email",
    header: "Compte",
    cell: ({ row }) => (
      <div>
        <div style={{ fontWeight: 800 }}>{row.original.email ?? "—"}</div>
        {row.original.username && <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>@{row.original.username}</div>}
      </div>
    ),
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ getValue }) => <Badge tone="brand">{PLAN_LABEL[getValue() as string] ?? (getValue() as string)}</Badge>,
  },
  {
    accessorKey: "subscription_status",
    header: "Abonnement",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      if (!v) return <span style={{ color: "var(--ap-muted)" }}>—</span>;
      return <Badge tone={v === "active" ? "brand" : "warn"}>{v}</Badge>;
    },
  },
  {
    accessorKey: "role",
    header: "Rôle",
    cell: ({ getValue }) => (getValue() === "admin" ? <Badge tone="warn">Admin</Badge> : <span style={{ color: "var(--ap-muted)" }}>Utilisateur</span>),
  },
  {
    accessorKey: "created_at",
    header: "Inscrit le",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("fr-FR"),
  },
  {
    accessorKey: "last_sign_in_at",
    header: "Dernière connexion",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString("fr-FR") : <span style={{ color: "var(--ap-muted)" }}>Jamais</span>;
    },
  },
];

export const UsersTab = () => {
  const { data, isLoading } = useAdminUsers();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((u) => u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <h3><Users className="h-4 w-4" style={{ display: "inline", verticalAlign: "-3px" }} /> Comptes <span className="adm-tag">{isLoading ? "…" : (data ?? []).length}</span></h3>
      </div>
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (data ?? []).length === 0 ? (
        <div className="adm-empty"><span className="e-emo"><Inbox style={{ width: 30, height: 30 }} /></span>Aucun compte pour le moment.</div>
      ) : (
        <>
          <div style={{ marginBottom: 14, maxWidth: 320 }}>
            <Input placeholder="Rechercher par email ou pseudo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <DataTable columns={columns} data={rows} emptyMessage="Aucun compte ne correspond à cette recherche." />
        </>
      )}
    </div>
  );
};
