import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases, useContentMutations } from "@/lib/pages/adminHooks";
import { RoadmapEditor } from "./editors/RoadmapEditor";
import { GuideEditor } from "./editors/GuideEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { ChangelogEditor } from "./editors/ChangelogEditor";

type Res = "roadmap_items" | "guides" | "faq_items" | "changelog_releases";
const RES_LABEL: Record<Res, string> = {
  roadmap_items: "Roadmap", guides: "Guides", faq_items: "FAQ", changelog_releases: "Changelog",
};

export const ContentTab = () => {
  const [res, setRes] = useState<Res>("roadmap_items");
  const [editing, setEditing] = useState<{ open: boolean; row?: unknown }>({ open: false });

  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const releases = useAdminReleases();
  const mut = useContentMutations(res);

  const rows: { id: string; label: string; status: string }[] = (() => {
    if (res === "roadmap_items") return (roadmap.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "guides") return (guides.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "faq_items") return (faq.data ?? []).map((r) => ({ id: r.id, label: r.question, status: r.status }));
    return (releases.data ?? []).map((r) => ({ id: r.id, label: `${r.version} — ${r.title}`, status: r.status }));
  })();
  const fullRow = (id: string): unknown => {
    if (res === "roadmap_items") return roadmap.data?.find((r) => r.id === id);
    if (res === "guides") return guides.data?.find((r) => r.id === id);
    if (res === "faq_items") return faq.data?.find((r) => r.id === id);
    return releases.data?.find((r) => r.id === id);
  };

  const onSave = (values: Record<string, unknown>) => {
    const row = editing.row as { id?: string } | undefined;
    if (row?.id) mut.update.mutate({ id: row.id, patch: values });
    else mut.create.mutate(values);
    setEditing({ open: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Select value={res} onValueChange={(x) => setRes(x as Res)}>
          <SelectTrigger style={{ width: 220 }}><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(RES_LABEL) as Res[]).map((r) => <SelectItem key={r} value={r}>{RES_LABEL[r]}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => setEditing({ open: true, row: undefined })}>Nouveau</Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Titre</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.label}</TableCell>
              <TableCell><Badge variant={row.status === "published" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
              <TableCell style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="outline" onClick={() => setEditing({ open: true, row: fullRow(row.id) })}>Éditer</Button>
                <Button size="sm" variant="outline" onClick={() => mut.setStatus.mutate({ id: row.id, status: row.status === "published" ? "draft" : "published" })}>
                  {row.status === "published" ? "Dépublier" : "Publier"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Suppr.</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => mut.remove.mutate(row.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing.open && res === "roadmap_items" && (
        <RoadmapEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof RoadmapEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "guides" && (
        <GuideEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof GuideEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "faq_items" && (
        <FaqEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof FaqEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "changelog_releases" && (
        <ChangelogEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof ChangelogEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
    </div>
  );
};
