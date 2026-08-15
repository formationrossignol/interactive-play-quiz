import { useEffect, useState } from "react";
import { Accessibility as AccessibilityIcon, AlertTriangle, CheckCircle2, Plus, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import { listContent } from "@/lib/content/contentRepo";
import type { ContentRow, ContentType } from "@/lib/content/types";
import {
  checkContentAccessibility,
  createAccessibilityAudit,
  createAccommodationProfile,
  getEffectiveAccommodations,
  listOrgAccessibilityAudits,
  listOrgAccommodationProfiles,
  listPublishedAccessibilityAudits,
  myAccessibilityPreferences,
  setAccessibilityAuditPublished,
  setAccommodationRule,
  setContentAccessibilityCheckStatus,
  upsertMyAccessibilityPreferences,
  type AccessibilityAudit,
  type AccessibilityPreferences,
  type AccommodationProfile,
  type ContentAccessibilityCheck,
  type EffectiveAccommodation,
} from "@/lib/lms/accessibility";

const STAFF_ROLES = new Set(["registrar", "pedago", "admin"]);
const CHECKABLE_TYPES: ContentType[] = ["quiz", "poll", "exam"];
const auditStatusLabel: Record<AccessibilityAudit['status'], string> = {
  conformant: "Conforme",
  partially_conformant: "Partiellement conforme",
  not_audited: "Non audité",
};

function PreferencesPanel({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<AccessibilityPreferences | null>(null);
  const [effective, setEffective] = useState<EffectiveAccommodation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([myAccessibilityPreferences(), getEffectiveAccommodations(userId)])
      .then(([p, e]) => { setPrefs(p); setEffective(e); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [userId]);

  const toggle = async (key: keyof AccessibilityPreferences, value: boolean) => {
    try {
      const updated = await upsertMyAccessibilityPreferences(userId, { [key]: value });
      setPrefs(updated);
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <>
      <section className="product-list-panel p-5">
        <div className="product-panel-heading -mx-5 -mt-5 mb-4">
          <div><h2>Préférences d'affichage</h2><p>Réglages personnels, non certifiés — ils ne remplacent pas un aménagement institutionnel.</p></div>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Contraste élevé</span>
            <Switch checked={prefs?.high_contrast ?? false} onCheckedChange={(v) => toggle("high_contrast", v)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Réduire les animations</span>
            <Switch checked={prefs?.reduce_motion ?? false} onCheckedChange={(v) => toggle("reduce_motion", v)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Lecture à voix haute</span>
            <Switch checked={prefs?.text_to_speech ?? false} onCheckedChange={(v) => toggle("text_to_speech", v)} />
          </label>
        </div>
      </section>

      <section className="product-list-panel p-5 mt-4">
        <div className="product-panel-heading -mx-5 -mt-5 mb-4">
          <div><h2>Mes aménagements actifs</h2><p>Appliqués automatiquement à vos activités ; les autres participants ne les voient jamais.</p></div>
        </div>
        {effective.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun aménagement institutionnel actif.</p>
        ) : (
          <ul className="space-y-2">
            {effective.map((e) => (
              <li key={e.rule_type} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{e.rule_type}</span>
                <span className="text-muted-foreground">{JSON.stringify(e.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const severityColor: Record<ContentAccessibilityCheck['severity'], string> = {
  error: "var(--ap-danger)",
  warning: "var(--ap-warn, #b45309)",
};

/** A11Y-007/009/010: check_content_accessibility() (20260815020000) had no
 *  UI caller — this is the first screen that runs it. Owner-scoped (any
 *  content creator, not just LMS staff — alt-text/language gaps exist on
 *  personal content too). */
function ContentCheckerPanel({ userId }: { userId: string }) {
  const [type, setType] = useState<ContentType>("quiz");
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ContentAccessibilityCheck[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setResults([]);
    setSelectedId("");
    listContent(userId, type).then(setItems).catch(showError).finally(() => setLoading(false));
  }, [userId, type]);

  const runCheck = async (contentId: string) => {
    setSelectedId(contentId);
    setChecking(true);
    try {
      setResults(await checkContentAccessibility(contentId));
    } catch (err) {
      showError(err);
    } finally {
      setChecking(false);
    }
  };

  const toggleStatus = async (check: ContentAccessibilityCheck) => {
    setUpdatingId(check.id);
    try {
      const next = check.status === "ignored" ? "open" : "ignored";
      const updated = await setContentAccessibilityCheckStatus(check.id, next);
      setResults((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      showError(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Vérificateur d'accessibilité</h2><p>Texte alternatif, langue déclarée et interactions sans équivalent clavier connu (A11Y-007/009/013).</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {CHECKABLE_TYPES.map((t) => (
          <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>{t}</Button>
        ))}
      </div>
      {loading ? <TableSkeleton rows={2} cols={2} /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun contenu de type « {type} ».</p>
      ) : (
        <ul className="space-y-2" aria-label="Contenus vérifiables">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{String((item.data as { title?: string })?.title ?? item.id.slice(0, 8))}</span>
                <Button size="sm" variant="outline" loading={checking && selectedId === item.id} onClick={() => runCheck(item.id)}>Vérifier</Button>
              </div>
              {selectedId === item.id && results.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-t pt-2" aria-label="Résultats">
                  {results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        {r.severity === "error" ? <AlertTriangle size={12} color={severityColor.error} /> : <AlertTriangle size={12} color={severityColor.warning} />}
                        <span style={{ color: r.status === "fixed" ? "var(--ap-pres)" : undefined, textDecoration: r.status === "ignored" ? "line-through" : undefined }}>
                          {r.message}
                        </span>
                        <span className="text-muted-foreground">({r.location})</span>
                      </span>
                      {r.status !== "fixed" && (
                        <Button size="sm" variant="ghost" loading={updatingId === r.id} onClick={() => toggleStatus(r)}>
                          {r.status === "ignored" ? "Rouvrir" : "Ignorer"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {selectedId === item.id && !checking && results.length === 0 && (
                <p className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs" style={{ color: "var(--ap-pres)" }}>
                  <CheckCircle2 size={12} /> Aucun problème détecté.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** ACC/A11Y: accessibility_audits existed since 20260810190000 with no
 *  writer/reader UI at all — the RLS already distinguishes org-admin
 *  management from public read (published=true, no org check, by
 *  design — see spec's "publication d'une déclaration factuelle"). */
function AccessibilityAuditsPanel({ orgId }: { orgId: string }) {
  const [audits, setAudits] = useState<AccessibilityAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState<AccessibilityAudit['status']>("not_audited");
  const [creating, setCreating] = useState(false);

  const reload = () => listOrgAccessibilityAudits(orgId).then(setAudits).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scope.trim() || !method.trim()) return;
    setCreating(true);
    try {
      const audit = await createAccessibilityAudit(orgId, scope.trim(), method.trim(), status);
      setAudits((prev) => [audit, ...prev]);
      setScope(""); setMethod("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (audit: AccessibilityAudit) => {
    try {
      await setAccessibilityAuditPublished(audit.id, !audit.published);
      setAudits((prev) => prev.map((a) => (a.id === audit.id ? { ...a, published: !a.published } : a)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Déclaration d'accessibilité</h2><p>Ne revendique pas de conformité avant audit externe — distingue conforme, partiellement conforme et non audité.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[180px] space-y-1">
          <label className="text-sm font-medium" htmlFor="audit-scope">Périmètre</label>
          <Input id="audit-scope" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="ex. Parcours apprenant" required />
        </div>
        <div className="min-w-[180px] space-y-1">
          <label className="text-sm font-medium" htmlFor="audit-method">Méthode</label>
          <Input id="audit-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="ex. Audit manuel + NVDA" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="audit-status">Statut</label>
          <select id="audit-status" value={status} onChange={(e) => setStatus(e.target.value as AccessibilityAudit['status'])} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value="not_audited">Non audité</option>
            <option value="partially_conformant">Partiellement conforme</option>
            <option value="conformant">Conforme</option>
          </select>
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Enregistrer</Button>
      </form>
      {audits.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun audit enregistré.</p>
      ) : (
        <ul className="space-y-2">
          {audits.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{a.scope} · {auditStatusLabel[a.status]} · {a.audited_on}</span>
              <label className="flex items-center gap-2 text-xs">
                Publié
                <Switch checked={a.published} onCheckedChange={() => togglePublish(a)} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PublishedDeclarations() {
  const [audits, setAudits] = useState<AccessibilityAudit[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listPublishedAccessibilityAudits().then(setAudits).catch(showError).finally(() => setLoading(false));
  }, []);
  if (loading) return <TableSkeleton rows={2} cols={2} />;
  if (audits.length === 0) return null;
  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Déclarations publiées</h2><p>Statut factuel, jamais une revendication de conformité totale non vérifiée.</p></div>
      </div>
      <ul className="space-y-2">
        {audits.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>{a.scope} — {a.method}</span>
            <span className="text-muted-foreground">{auditStatusLabel[a.status]} · {a.audited_on}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StaffAccommodations({ orgId }: { orgId: string }) {
  const [profiles, setProfiles] = useState<AccommodationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [learnerId, setLearnerId] = useState("");
  const [creating, setCreating] = useState(false);
  const [rulePercent, setRulePercent] = useState<Record<string, string>>({});

  useEffect(() => {
    listOrgAccommodationProfiles(orgId).then(setProfiles).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnerId.trim()) return;
    setCreating(true);
    try {
      const profile = await createAccommodationProfile(orgId, learnerId.trim());
      setProfiles((prev) => [profile, ...prev]);
      setLearnerId("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSetExtraTime = async (profileId: string) => {
    const percent = Number(rulePercent[profileId]);
    if (!percent) return;
    try {
      await setAccommodationRule(profileId, "extra_time", { percent });
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Aménagements institutionnels</h2><p>Profils par apprenant, séparés du profil public. Aucun motif médical n'est stocké.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[280px] space-y-1">
          <label className="text-sm font-medium" htmlFor="learner-id">Identifiant apprenant (UUID)</label>
          <Input id="learner-id" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Créer un profil</Button>
      </form>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun profil d'aménagement créé.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>Apprenant {p.learner_id.slice(0, 8)} · {p.status}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  className="w-20"
                  placeholder="% temps"
                  value={rulePercent[p.id] ?? ""}
                  onChange={(e) => setRulePercent((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  aria-label="Temps supplémentaire en %"
                />
                <Button variant="ghost" size="sm" onClick={() => handleSetExtraTime(p.id)}>Appliquer</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LmsAccessibility() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Accessibilité & aménagements", description: "Préférences d'affichage et aménagements individuels." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));
  const isAdmin = memberships.some((m) => m.org_id === activeOrgId && m.role === "admin");

  if (loading || !user) {
    return (
      <AppLayout subtitle="Accessibilité">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Accessibilité">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Accessibilité et aménagements"
          description="Expérience inclusive et aménagements individuels confidentiels."
        />
        {isStaff && activeOrgId ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <ShieldCheck size={16} /> Gestion réservée au personnel autorisé (registrar/pedago/admin).
            </div>
            <StaffAccommodations orgId={activeOrgId} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <AccessibilityIcon size={16} /> Vos réglages restent privés.
            </div>
            <PreferencesPanel userId={user.id} />
          </>
        )}
        <ContentCheckerPanel userId={user.id} />
        {isAdmin && activeOrgId && <AccessibilityAuditsPanel orgId={activeOrgId} />}
        <PublishedDeclarations />
      </div>
    </AppLayout>
  );
}
