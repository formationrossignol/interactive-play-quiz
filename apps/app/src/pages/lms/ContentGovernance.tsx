import { useEffect, useState } from "react";
import { GitCommitVertical, MessageSquare, Plus, Upload } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import {
  addContentComment,
  listContentComments,
  listContentVersions,
  publishContentVersion,
  restoreContentVersion,
  type ContentComment,
  type ContentVersion,
} from "@/lib/lms/contentGovernance";

function ContentVersionPanel({ item }: { item: ContentRow }) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [changelog, setChangelog] = useState("");
  const [comment, setComment] = useState("");
  const [publishing, setPublishing] = useState(false);

  const reload = () => {
    Promise.all([listContentVersions(item.id), listContentComments(item.id)])
      .then(([v, c]) => { setVersions(v); setComments(c); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const latestVersion = versions[0]?.version ?? 0;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishContentVersion(item.id, latestVersion, item.data, changelog || undefined);
      setChangelog("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleRestore = async (version: number) => {
    try {
      await restoreContentVersion(item.id, version);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const c = await addContentComment(item.id, comment.trim());
      setComments((prev) => [...prev, c]);
      setComment("");
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={`changelog-${item.id}`}>Note de version</label>
          <Input id={`changelog-${item.id}`} value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="Ce qui a changé…" />
        </div>
        <Button size="sm" loading={publishing} onClick={handlePublish}><Upload /> Publier v{latestVersion + 1}</Button>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune version publiée.</p>
      ) : (
        <ul className="space-y-1">
          {versions.map((v) => (
            <li key={v.id} className="text-sm rounded border px-3 py-1.5 flex items-center justify-between">
              <span>v{v.version} · {v.status} {v.changelog ? `— ${v.changelog}` : ""}</span>
              <Button variant="ghost" size="sm" onClick={() => handleRestore(v.version)}>Restaurer</Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><MessageSquare size={14} /> Commentaires</h4>
        <form onSubmit={handleComment} className="flex items-end gap-2 mb-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ajouter un commentaire…" className="flex-1" />
          <Button type="submit" size="sm"><Plus /></Button>
        </form>
        {comments.length > 0 && (
          <ul className="space-y-1">
            {comments.map((c) => (
              <li key={c.id} className="text-sm rounded border px-3 py-1.5">{c.body}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LmsContentGovernance() {
  const user = getCurrentUser();
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  useSEO({ title: "Gouvernance de contenu", description: "Versions, revue et publication du contenu." });

  useEffect(() => {
    if (!user) return;
    listRecentContent(user.id, 20).then(setItems).catch(showError).finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Gouvernance de contenu">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Gouvernance de contenu">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Gouvernance et diffusion du contenu"
          description="Un identifiant durable, des versions immuables et une publication jamais silencieuse."
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Vos contenus</h2><p>Publier crée une version immuable ; une publication concurrente sur une base obsolète est refusée.</p></div>
          </div>
          {items.length === 0 ? (
            <ExplorerEmptyState icon={<GitCommitVertical size={27} />} title="Aucun contenu" body="Créez un quiz, un cours ou un examen pour commencer à versionner sa publication." />
          ) : (
            <ul className="space-y-2" aria-label="Contenus">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{String((item.data as { title?: string })?.title ?? item.type)} <span className="text-muted-foreground">({item.type})</span></span>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}>
                      {expanded === item.id ? "Fermer" : "Versions"}
                    </Button>
                  </div>
                  {expanded === item.id && <ContentVersionPanel item={item} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
