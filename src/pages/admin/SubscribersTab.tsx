import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscribers } from "@/lib/pages/adminHooks";

export const SubscribersTab = () => {
  const { data, isLoading } = useSubscribers();
  const rows = data ?? [];
  return (
    <div style={{ paddingTop: 16 }}>
      <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        {isLoading ? "…" : rows.length} <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>abonné{rows.length > 1 ? "s" : ""} au changelog</span>
      </p>
      <Table>
        <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Abonné le</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.user_id}>
              <TableCell style={{ fontFamily: "monospace" }}>{s.user_id.slice(0, 8)}…</TableCell>
              <TableCell>{new Date(s.created_at).toLocaleDateString("fr-FR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
