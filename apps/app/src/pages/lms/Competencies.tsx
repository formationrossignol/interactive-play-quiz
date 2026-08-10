import { useEffect, useMemo, useState } from "react";
import { Award, Plus, Target } from "lucide-react";
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
  addCompetency,
  createFramework,
  listFrameworkCompetencies,
  listOrgFrameworks,
  myMastery,
  publishFramework,
  type Competency,
  type CompetencyFramework,
  type CompetencyMastery,
} from "@/lib/lms/competencies";

const STAFF_ROLES = new Set(["pedago", "admin"]);

const levelLabel: Record<string, string> = {
  not_assessed: "Non évalué",
  beginner: "Débutant",
  in_progress: "En acquisition",
  mastered: "Maîtrisé",
  expert: "Expert",
};

function FrameworkCompetencies({ framework }: { framework: CompetencyFramework }) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    listFrameworkCompetencies(framework.id).then(setCompetencies).catch(showError).finally(() => setLoading(false));
  }, [framework.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;
    setAdding(true);
    try {
      const competency = await addCompetency(framework.id, code.trim(), title.trim());
      setCompetencies((prev) => [...prev, competency]);
      setCode(""); setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="w-24 space-y-1">
          <label className="text-sm font-medium" htmlFor={`code-${framework.id}`}>Code</label>
          <Input id={`code-${framework.id}`} value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={`title-${framework.id}`}>Titre</label>
          <Input id={`title-${framework.id}`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Button size="sm" type="submit" loading={adding}><Plus /> Ajouter</Button>
      </form>
      {competencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune compétence dans ce référentiel.</p>
      ) : (
        <ul className="space-y-1">
          {competencies.map((c) => (
            <li key={c.id} className="text-sm rounded border px-3 py-1.5">
              <span className="font-mono text-muted-foreground mr-2">{c.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffFrameworks({ orgId }: { orgId: string }) {
  const [frameworks, setFrameworks] = useState<CompetencyFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listOrgFrameworks(orgId).then(setFrameworks).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const framework = await createFramework(orgId, title.trim());
      setFrameworks((prev) => [framework, ...prev]);
      setFormOpen(false);
      setTitle("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishFramework(id);
      setFrameworks((prev) => prev.map((f) => (f.id === id ? { ...f, status: "published" } : f)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={3} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Référentiels de compétences</h2><p>Définissez la structure, publiez et alignez vos contenus.</p></div>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}><Plus /> Nouveau référentiel</Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="min-w-[220px] space-y-1">
            <label className="text-sm font-medium" htmlFor="framework-title">Titre</label>
            <Input id="framework-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <Button type="submit" loading={creating}>Créer</Button>
        </form>
      )}

      {frameworks.length === 0 ? (
        <ExplorerEmptyState
          icon={<Target size={27} />}
          title="Aucun référentiel"
          body="Créez un référentiel, ajoutez des compétences puis publiez-le pour l'aligner sur vos contenus."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Créer un référentiel</Button>}
        />
      ) : (
        <ul className="space-y-2" aria-label="Référentiels">
          {frameworks.map((f) => (
            <li key={f.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.status === "published" ? "Publié" : "Brouillon"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {f.status === "draft" && (
                    <Button variant="ghost" size="sm" onClick={() => handlePublish(f.id)}>Publier</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === f.id ? null : f.id))}>
                    {expanded === f.id ? "Fermer" : "Compétences"}
                  </Button>
                </div>
              </div>
              {expanded === f.id && <FrameworkCompetencies framework={f} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LearnerMastery() {
  const [mastery, setMastery] = useState<CompetencyMastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myMastery().then(setMastery).catch(showError).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  if (mastery.length === 0) {
    return (
      <ExplorerEmptyState
        icon={<Award size={27} />}
        title="Aucune compétence évaluée"
        body="Vos niveaux de maîtrise apparaîtront ici au fil de vos activités notées."
      />
    );
  }

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Mes compétences</h2><p>Niveau actuel et dernière mise à jour.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Mes compétences">
        {mastery.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Compétence {m.competency_id.slice(0, 8)}</span>
            <span className="text-sm font-medium">{levelLabel[m.level_code] ?? m.level_code}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LmsCompetencies() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Compétences", description: "Référentiels, alignements, preuves et maîtrise." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = useMemo(
    () => memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role)),
    [memberships, activeOrgId],
  );

  if (loading) {
    return (
      <AppLayout subtitle="Compétences">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Compétences">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Compétences et résultats d'apprentissage"
          description="Référentiels gouvernés, preuves traçables et maîtrise explicable."
        />
        {isStaff && activeOrgId ? <StaffFrameworks orgId={activeOrgId} /> : <LearnerMastery />}
      </div>
    </AppLayout>
  );
}
