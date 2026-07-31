import { Fragment, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeletons";
import { showError } from "@/lib/errorTaxonomy";
import { roleLabel } from "@/lib/org/roleLabels";
import { adminListAllOrgs, listOrgMembers, type AdminOrgSummary, type OrgMember } from "@/lib/org/orgRepo";

function MemberRosterReadOnly({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listOrgMembers(orgId)
      .then((m) => { if (!cancelled) setMembers(m); })
      .catch(showError)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) return <TableSkeleton rows={3} cols={3} />;
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground p-3">Aucun membre.</p>;
  }

  return (
    <ul className="space-y-2 p-3" aria-label="Membres (lecture seule)">
      {members.map((member) => (
        <li key={member.user_id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium">{member.username ?? member.email}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {member.roles.map((role) => (
              <Badge key={role} variant="secondary">{roleLabel(role)}</Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OrganizationsTab() {
  const [orgs, setOrgs] = useState<AdminOrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  useEffect(() => {
    adminListAllOrgs().then(setOrgs).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={5} cols={4} />;

  if (orgs.length === 0) {
    return (
      <div className="product-empty-inline">
        <div><strong>Aucune organisation</strong><span>Les organisations créées apparaîtront ici.</span></div>
      </div>
    );
  }

  return (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <h2>Organisations</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Membres</TableHead>
            <TableHead>Accès invité</TableHead>
            <TableHead>Créée le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <Fragment key={org.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpandedOrgId((prev) => (prev === org.id ? null : org.id))}
              >
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.member_count}</TableCell>
                <TableCell>
                  <Badge variant={org.guest_access_enabled ? "default" : "secondary"}>
                    {org.guest_access_enabled ? "Activé" : "Désactivé"}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(org.created_at).toLocaleDateString("fr-FR")}</TableCell>
              </TableRow>
              {expandedOrgId === org.id && (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <MemberRosterReadOnly orgId={org.id} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
