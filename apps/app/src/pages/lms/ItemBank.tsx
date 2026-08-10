import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
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
  createItem,
  createItemRevision,
  listItemRevisions,
  listOrgItems,
  type AssessmentItem,
  type ItemRevision,
} from "@/lib/lms/itemBank";

const STAFF_ROLES = new Set(["trainer", "pedago", "admin"]);

function ItemRevisions({ item }: { item: AssessmentItem }) {
  const [revisions, setRevisions] = useState<ItemRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listItemRevisions(item.id).then(setRevisions).catch(showError).finally(() => setLoading(false));
  }, [item.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      const revision = await createItemRevision({ itemId: item.id, promptText: prompt.trim(), correctAnswer: answer.trim(), changelog: `Révision ${revisions.length + 1}` });
      setRevisions((prev) => [revision, ...prev]);
      setPrompt(""); setAnswer("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={`prompt-${item.id}`}>Énoncé</label>
          <Input id={`prompt-${item.id}`} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className="text-sm font-medium" htmlFor={`answer-${item.id}`}>Réponse correcte</label>
          <Input id={`answer-${item.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}><Plus /> Nouvelle révision</Button>
      </form>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune révision.</p>
      ) : (
        <ul className="space-y-1">
          {revisions.map((r) => (
            <li key={r.id} className="text-sm rounded border px-3 py-1.5 flex items-center justify-between">
              <span>v{r.version} · {String((r.prompt as { text?: string }).text ?? "")}</span>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LmsItemBank() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemType, setItemType] = useState("mcq");
  const [creating, setCreating] = useState(false);
  useSEO({ title: "Banque d'items", description: "Items versionnés, réutilisables et analysables." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    listOrgItems(activeOrgId).then(setItems).catch(showError).finally(() => setItemsLoading(false));
  }, [activeOrgId]);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setCreating(true);
    try {
      const item = await createItem(activeOrgId, itemType);
      setItems((prev) => [item, ...prev]);
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout subtitle="Banque d'items">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isStaff || !activeOrgId) {
    return (
      <AppLayout subtitle="Banque d'items">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Cette vue est réservée aux formateurs, responsables et administrateurs.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Banque d'items">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Banque d'items versionnée"
          description="Corriger un item publié crée une révision — les tentatives passées ne sont jamais modifiées."
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Items</h2><p>Réponses correctes conservées côté serveur uniquement.</p></div>
          </div>
          <form onSubmit={handleCreateItem} className="flex flex-wrap items-end gap-2 mb-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="item-type">Type</label>
              <select id="item-type" value={itemType} onChange={(e) => setItemType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="mcq">QCM</option>
                <option value="single_choice">Choix unique</option>
                <option value="true_false">Vrai/Faux</option>
                <option value="short_answer">Réponse courte</option>
              </select>
            </div>
            <Button type="submit" size="sm" loading={creating}><Plus /> Créer un item</Button>
          </form>

          {itemsLoading ? <TableSkeleton rows={3} cols={2} /> : items.length === 0 ? (
            <ExplorerEmptyState icon={<Layers size={27} />} title="Banque vide" body="Créez un item puis ajoutez sa première révision avec l'énoncé et la réponse correcte." />
          ) : (
            <ul className="space-y-2" aria-label="Items">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.item_type} · {item.status}</span>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}>
                      {expanded === item.id ? "Fermer" : "Révisions"}
                    </Button>
                  </div>
                  {expanded === item.id && <ItemRevisions item={item} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
