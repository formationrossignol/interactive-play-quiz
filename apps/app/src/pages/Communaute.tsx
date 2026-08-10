import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSEO } from "@/hooks/useSEO";
import { getCurrentUser } from "@/lib/auth";
import {
  createCommunityThread,
  deleteCommunityThread,
  listCommunityThreads,
  setCommunityThreadLike,
  updateCommunityThread,
  type CommunityCategory,
  type CommunityThread,
} from "@/lib/community/communityRepo";
import { myOrgMemberships } from "@/lib/org/orgRepo";
import "./community-pages.css";

const CATEGORY_META: Array<{ key: CommunityCategory; icon: string; title: string; description: string }> = [
  { key: "announcements", icon: "campaign", title: "Annonces", description: "Nouveautés de votre espace" },
  { key: "help", icon: "support_agent", title: "Entraide", description: "Questions et réponses" },
  { key: "sharing", icon: "share", title: "Partage de quiz", description: "Créations de votre organisation" },
  { key: "ideas", icon: "lightbulb", title: "Idées & votes", description: "Priorités de votre équipe" },
];

const CATEGORY_LABEL = Object.fromEntries(
  CATEGORY_META.map((category) => [category.key, category.title]),
) as Record<CommunityCategory, string>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const Communaute = () => {
  const user = getCurrentUser();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<CommunityCategory | "all">("all");
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicCategory, setNewTopicCategory] = useState<CommunityCategory>("help");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicBody, setNewTopicBody] = useState("");
  const [openedThreadId, setOpenedThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<CommunityCategory>("help");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [deletingThread, setDeletingThread] = useState<CommunityThread | null>(null);

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ["org", "memberships", user?.id],
    queryFn: myOrgMemberships,
    enabled: Boolean(user),
  });
  const [activeOrgId] = useActiveOrgId(memberships);
  const activeMembership = memberships.find((membership) => membership.org_id === activeOrgId) ?? memberships[0];
  const resolvedOrgId = activeMembership?.org_id ?? null;
  const activeOrgName = activeMembership?.organizations.name ?? "votre organisation";

  const { data: threads = [], isLoading: threadsLoading, isError } = useQuery({
    queryKey: ["community", resolvedOrgId, user?.id],
    queryFn: () => listCommunityThreads(resolvedOrgId as string, user?.id as string),
    enabled: Boolean(resolvedOrgId && user?.id),
  });

  const createThread = useMutation({
    mutationFn: () => createCommunityThread({
      orgId: resolvedOrgId as string,
      authorUserId: user?.id as string,
      authorName: user?.username || user?.email || "Membre",
      category: newTopicCategory,
      title: newTopicTitle,
      body: newTopicBody,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community", resolvedOrgId] });
      setNewTopicTitle("");
      setNewTopicBody("");
      setNewTopicOpen(false);
      toast.success("Sujet publié dans votre organisation");
    },
    onError: () => toast.error("Le sujet n’a pas pu être publié"),
  });

  const toggleLike = useMutation({
    mutationFn: ({ threadId, liked }: { threadId: string; liked: boolean }) =>
      setCommunityThreadLike(threadId, user?.id as string, liked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community", resolvedOrgId] }),
    onError: () => toast.error("Le vote n’a pas pu être enregistré"),
  });

  const updateThread = useMutation({
    mutationFn: () => updateCommunityThread(editingThreadId as string, {
      category: editCategory,
      title: editTitle,
      body: editBody,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community", resolvedOrgId] });
      setEditingThreadId(null);
      setOpenedThreadId(null);
      toast.success("Sujet mis à jour");
    },
    onError: () => toast.error("Le sujet n’a pas pu être modifié"),
  });

  const deleteThread = useMutation({
    mutationFn: (threadId: string) => deleteCommunityThread(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community", resolvedOrgId] });
      setDeletingThread(null);
      setOpenedThreadId(null);
      toast.success("Sujet supprimé");
    },
    onError: () => toast.error("Le sujet n’a pas pu être supprimé"),
  });

  const visibleThreads = category === "all" ? threads : threads.filter((thread) => thread.category === category);
  const topIdeas = threads
    .filter((thread) => thread.category === "ideas")
    .sort((left, right) => right.likes - left.likes)
    .slice(0, 3);
  const contributors = useMemo(() => {
    const scores = new Map<string, { name: string; score: number }>();
    threads.forEach((thread) => {
      const current = scores.get(thread.authorUserId) ?? { name: thread.authorName, score: 0 };
      current.score += 1 + thread.likes + thread.replies;
      scores.set(thread.authorUserId, current);
    });
    return [...scores.values()].sort((left, right) => right.score - left.score).slice(0, 3);
  }, [threads]);
  const openedThread = threads.find((thread) => thread.id === openedThreadId) ?? null;

  const beginEdit = (thread: CommunityThread) => {
    setOpenedThreadId(null);
    setEditingThreadId(thread.id);
    setEditCategory(thread.category);
    setEditTitle(thread.title);
    setEditBody(thread.body);
  };

  useSEO({
    title: `Communauté · ${activeOrgName}`,
    description: "Échangez, partagez et votez avec les membres de votre organisation.",
    path: "/community",
  });

  return (
    <AppLayout subtitle="Communauté">
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero community-hero">
            <span className="community-hero__org"><MaterialSymbol name="domain" size={17} /> {activeOrgName}</span>
            <h1 className="ap-h2">La communauté de votre organisation.</h1>
            <p className="lead">Les discussions, créations et votes ci-dessous restent dans cet espace.</p>
          </div>

          {membershipsLoading ? (
            <div className="community-state">Chargement de votre organisation…</div>
          ) : !resolvedOrgId ? (
            <div className="card community-state">
              <MaterialSymbol name="domain_disabled" size={28} />
              <strong>Aucune organisation active</strong>
              <span>Rejoignez ou créez une organisation pour accéder à sa communauté.</span>
            </div>
          ) : (
            <>
              <div className="ccats" aria-label="Filtrer les discussions">
                {CATEGORY_META.map((item) => {
                  const count = threads.filter((thread) => thread.category === item.key).length;
                  const selected = category === item.key;
                  return (
                    <button
                      type="button"
                      className={`card ccat${selected ? " is-active" : ""}`}
                      key={item.key}
                      aria-pressed={selected}
                      onClick={() => setCategory((current) => current === item.key ? "all" : item.key)}
                    >
                      <span className="cemo"><MaterialSymbol name={item.icon} size={20} /></span>
                      <span>
                        <b>{item.title}</b>
                        <small>{item.description} · {count} sujet{count > 1 ? "s" : ""}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="comm-grid">
                <section className="card community-discussions">
                  <header className="community-section-header">
                    <div>
                      <h2>Discussions {category === "all" ? "récentes" : `· ${CATEGORY_LABEL[category]}`}</h2>
                      <span>{visibleThreads.length} sujet{visibleThreads.length > 1 ? "s" : ""} dans {activeOrgName}</span>
                    </div>
                    <Button size="sm" onClick={() => setNewTopicOpen(true)}>
                      <MaterialSymbol name="add" size={18} /> Nouveau sujet
                    </Button>
                  </header>

                  {threadsLoading ? (
                    <div className="community-state">Chargement des discussions…</div>
                  ) : isError ? (
                    <div className="community-state">Impossible de charger les discussions.</div>
                  ) : visibleThreads.length === 0 ? (
                    <div className="community-state">
                      <MaterialSymbol name="forum" size={28} />
                      <strong>Aucune discussion dans cette catégorie</strong>
                      <span>Publiez le premier sujet de votre organisation.</span>
                    </div>
                  ) : visibleThreads.map((thread) => {
                    const isOwner = thread.authorUserId === user?.id;
                    return (
                      <article className="threadrow" key={thread.id}>
                        <button type="button" className="community-thread-open" onClick={() => setOpenedThreadId(thread.id)}>
                          <span className="tav" aria-hidden="true">{thread.authorName.trim().charAt(0).toUpperCase()}</span>
                          <span className="tt">
                            <b>{thread.title}</b>
                            <small>{CATEGORY_LABEL[thread.category]} · par {thread.authorName} · {formatDate(thread.createdAt)}</small>
                          </span>
                          {thread.solved && <span className="solved"><MaterialSymbol name="task_alt" size={14} /> Résolu</span>}
                          <span className="tstats">
                            <span><MaterialSymbol name="favorite" size={15} /> {thread.likes}</span>
                            <span><MaterialSymbol name="chat_bubble" size={15} /> {thread.replies}</span>
                          </span>
                        </button>
                        {isOwner && (
                          <div className="community-thread-actions" aria-label={`Actions pour ${thread.title}`}>
                            <button type="button" aria-label={`Modifier ${thread.title}`} onClick={() => beginEdit(thread)}><MaterialSymbol name="edit" size={17} /></button>
                            <button type="button" aria-label={`Supprimer ${thread.title}`} onClick={() => setDeletingThread(thread)}><MaterialSymbol name="delete" size={17} /></button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>

                <aside className="community-aside">
                  <section className="card community-side-card">
                    <h2><MaterialSymbol name="lightbulb" size={18} /> Idées les plus votées</h2>
                    {topIdeas.length === 0 ? (
                      <div className="community-side-empty">Aucune idée proposée pour le moment.</div>
                    ) : topIdeas.map((idea) => (
                      <div className="iderow" key={idea.id}>
                        <button
                          type="button"
                          className={`vote${idea.likedByCurrentUser ? " on" : ""}`}
                          aria-label={`${idea.likedByCurrentUser ? "Retirer" : "Ajouter"} votre vote pour ${idea.title}`}
                          aria-pressed={idea.likedByCurrentUser}
                          disabled={toggleLike.isPending}
                          onClick={() => toggleLike.mutate({ threadId: idea.id, liked: idea.likedByCurrentUser })}
                        >
                          <MaterialSymbol name="keyboard_arrow_up" size={18} />
                          <span>{idea.likes}</span>
                        </button>
                        <div className="it"><b>{idea.title}</b><small>{idea.body || "Idée proposée à votre organisation"}</small></div>
                      </div>
                    ))}
                    <button type="button" className="community-text-action" onClick={() => { setNewTopicCategory("ideas"); setNewTopicOpen(true); }}>
                      Proposer une idée <MaterialSymbol name="arrow_forward" size={16} />
                    </button>
                  </section>

                  <section className="card community-side-card">
                    <h2><MaterialSymbol name="workspace_premium" size={18} /> Top contributeurs</h2>
                    {contributors.length === 0 ? (
                      <div className="community-side-empty">Les contributeurs apparaîtront ici.</div>
                    ) : contributors.map((contributor, index) => (
                      <div className="toprow" key={contributor.name}>
                        <span className="rank">{index + 1}</span>
                        <span className="community-contributor-avatar">{contributor.name.trim().charAt(0).toUpperCase()}</span>
                        <span>{contributor.name}</span>
                        <span className="tbadge">{contributor.score} pts</span>
                      </div>
                    ))}
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog open={newTopicOpen} onOpenChange={setNewTopicOpen}>
        <DialogContent className="community-topic-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau sujet</DialogTitle>
            <DialogDescription>Publié uniquement dans {activeOrgName}.</DialogDescription>
          </DialogHeader>
          <div className="community-topic-form">
            <label htmlFor="community-topic-category">
              <span>Catégorie</span>
              <select id="community-topic-category" value={newTopicCategory} onChange={(event) => setNewTopicCategory(event.target.value as CommunityCategory)}>
                {CATEGORY_META.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
              </select>
            </label>
            <label htmlFor="community-topic-title">
              <span>Titre</span>
              <Input id="community-topic-title" value={newTopicTitle} maxLength={180} onChange={(event) => setNewTopicTitle(event.target.value)} placeholder="Votre question ou votre idée" />
            </label>
            <label htmlFor="community-topic-body">
              <span>Message</span>
              <Textarea id="community-topic-body" value={newTopicBody} maxLength={12000} onChange={(event) => setNewTopicBody(event.target.value)} placeholder="Ajoutez le contexte utile aux membres de votre organisation" rows={6} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTopicOpen(false)}>Annuler</Button>
            <Button
              disabled={!newTopicTitle.trim() || createThread.isPending || !resolvedOrgId}
              onClick={() => createThread.mutate()}
            >
              {createThread.isPending ? "Publication…" : "Publier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openedThread)} onOpenChange={(open) => { if (!open) setOpenedThreadId(null); }}>
        <DialogContent className="community-thread-dialog sm:max-w-xl">
          {openedThread && (
            <>
              <DialogHeader>
                <DialogTitle>{openedThread.title}</DialogTitle>
                <DialogDescription>{CATEGORY_LABEL[openedThread.category]} · par {openedThread.authorName} · {formatDate(openedThread.createdAt)}</DialogDescription>
              </DialogHeader>
              <div className="community-thread-message">
                {openedThread.body || <span>Aucun message complémentaire.</span>}
              </div>
              <DialogFooter>
                {openedThread.authorUserId === user?.id && (
                  <>
                    <Button variant="outline" onClick={() => beginEdit(openedThread)}><MaterialSymbol name="edit" size={17} /> Modifier</Button>
                    <Button variant="destructive" onClick={() => { setOpenedThreadId(null); setDeletingThread(openedThread); }}><MaterialSymbol name="delete" size={17} /> Supprimer</Button>
                  </>
                )}
                <Button onClick={() => setOpenedThreadId(null)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingThreadId)} onOpenChange={(open) => { if (!open) setEditingThreadId(null); }}>
        <DialogContent className="community-topic-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le sujet</DialogTitle>
            <DialogDescription>Les changements seront visibles dans {activeOrgName}.</DialogDescription>
          </DialogHeader>
          <div className="community-topic-form">
            <label htmlFor="community-edit-category"><span>Catégorie</span>
              <select id="community-edit-category" value={editCategory} onChange={(event) => setEditCategory(event.target.value as CommunityCategory)}>
                {CATEGORY_META.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
              </select>
            </label>
            <label htmlFor="community-edit-title"><span>Titre</span>
              <Input id="community-edit-title" value={editTitle} maxLength={180} onChange={(event) => setEditTitle(event.target.value)} />
            </label>
            <label htmlFor="community-edit-body"><span>Message</span>
              <Textarea id="community-edit-body" value={editBody} maxLength={12000} rows={7} onChange={(event) => setEditBody(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingThreadId(null)}>Annuler</Button>
            <Button disabled={!editTitle.trim() || updateThread.isPending} onClick={() => updateThread.mutate()}>
              {updateThread.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingThread)} onOpenChange={(open) => { if (!open) setDeletingThread(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce sujet ?</DialogTitle>
            <DialogDescription>« {deletingThread?.title} » et ses réponses seront supprimés définitivement.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingThread(null)}>Annuler</Button>
            <Button variant="destructive" disabled={deleteThread.isPending} onClick={() => deletingThread && deleteThread.mutate(deletingThread.id)}>
              {deleteThread.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Communaute;
