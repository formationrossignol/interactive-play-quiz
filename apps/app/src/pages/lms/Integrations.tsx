import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Link2, Plug, Plus, RadioTower, Webhook, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { listOrgMembers, myOrgMemberships, type OrgMember, type OrgMembership } from "@/lib/org/orgRepo";
import {
  createApiClient,
  createIdentityConnection,
  createLtiDeployment,
  createLtiRegistration,
  createWebhookEndpoint,
  linkLtiSubject,
  listApiClients,
  listIdentityConnections,
  listLtiDeployments,
  listLtiLaunches,
  listLtiRegistrations,
  listWebhookEndpoints,
  testLtiConnection,
  type ApiClient,
  type IdentityConnection,
  type LtiConnectionTestResult,
  type LtiDeployment,
  type LtiLaunch,
  type LtiRegistration,
  type WebhookEndpoint,
} from "@/lib/lms/integrations";

function IdentitySection({ orgId }: { orgId: string }) {
  const [connections, setConnections] = useState<IdentityConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listIdentityConnections(orgId).then(setConnections).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const c = await createIdentityConnection(orgId, "oidc", name.trim());
      setConnections((prev) => [c, ...prev]);
      setName("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>SSO (OIDC/SAML)</h2><p>Connexions d'identité par organisation. Configuration uniquement — l'échange OIDC/SAML lui-même s'exécute côté serveur.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="idp-name">Nom du fournisseur</label>
          <Input id="idp-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}><Plus /> Ajouter (OIDC)</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : (
        <ul className="space-y-2">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{c.display_name} · {c.protocol.toUpperCase()}</span>
              <span className="text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const LAUNCH_ERROR_LABEL: Record<string, string> = {
  bad_signature_or_claims: "Signature ou revendications invalides",
  nonce_mismatch: "Nonce incohérent (rejeu ?)",
  missing_deployment_id: "Deployment ID absent du jeton",
  not_resource_link_request: "Type de message non supporté",
  unsupported_lti_version: "Version LTI non supportée",
  unknown_registration: "Enregistrement inconnu",
  unknown_deployment: "Déploiement inconnu — vérifiez le Deployment ID",
  linked_user_not_found: "Compte lié introuvable",
  session_mint_failed: "Échec de création de session",
  invalid_or_expired_state: "État expiré ou invalide",
};

function LinkSubjectForm({ registrationId, subject, orgId, members, onLinked }: {
  registrationId: string; subject: string; orgId: string; members: OrgMember[];
  onLinked: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLink = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await linkLtiSubject(registrationId, subject, userId);
      onLinked();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <select
        className="h-9 rounded-md border bg-transparent px-2 text-sm"
        style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        aria-label={`Relier le sub ${subject} à un compte`}
      >
        <option value="">Relier à…</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>{m.username ? `@${m.username}` : m.email}</option>
        ))}
      </select>
      <Button size="sm" variant="outline" disabled={!userId} loading={saving} onClick={handleLink}>
        <Link2 size={14} /> Lier
      </Button>
    </div>
  );
}

function LtiDiagnostics({ registrationId, orgId }: { registrationId: string; orgId: string }) {
  const [launches, setLaunches] = useState<LtiLaunch[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listLtiLaunches(registrationId).then(setLaunches).catch(showError).finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    listOrgMembers(orgId).then(setMembers).catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId, orgId]);

  if (loading) return <TableSkeleton rows={2} cols={3} />;
  if (launches.length === 0) return <p className="text-sm text-muted-foreground">Aucun lancement journalisé pour cet enregistrement.</p>;

  return (
    <ul className="space-y-2" aria-label="Lancements LTI">
      {launches.map((l) => {
        const unlinked = l.status === "success" && !l.user_id && l.subject;
        return (
          <li key={l.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                {l.status === "success" ? <CheckCircle2 size={14} style={{ color: "var(--ap-pres)" }} /> : <XCircle size={14} style={{ color: "var(--ap-danger)" }} />}
                {l.status === "success" ? (l.user_id ? "Lié" : "Non relié") : (LAUNCH_ERROR_LABEL[l.error_reason ?? ""] ?? l.error_reason ?? "Rejeté")}
              </span>
              <span className="text-muted-foreground text-xs">{new Date(l.launched_at).toLocaleString("fr-FR")}</span>
            </div>
            {l.subject && <p className="text-muted-foreground text-xs mt-1">sub : <code>{l.subject}</code>{l.deployment_id ? ` · deployment ${l.deployment_id}` : ""}</p>}
            {unlinked && (
              <LinkSubjectForm registrationId={registrationId} subject={l.subject!} orgId={orgId} members={members} onLinked={reload} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LtiDeployments({ registrationId }: { registrationId: string }) {
  const [deployments, setDeployments] = useState<LtiDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentId, setDeploymentId] = useState("");
  const [contextLabel, setContextLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLtiDeployments(registrationId).then(setDeployments).catch(showError).finally(() => setLoading(false));
  }, [registrationId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deploymentId.trim()) return;
    setSaving(true);
    try {
      const d = await createLtiDeployment(registrationId, deploymentId.trim(), contextLabel.trim());
      setDeployments((prev) => [d, ...prev]);
      setDeploymentId(""); setContextLabel("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ListSkeleton rows={1} withAvatar={false} />;

  return (
    <div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-2">
        <div className="min-w-[200px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`dep-id-${registrationId}`}>Deployment ID (exact, fourni par la plateforme)</label>
          <Input id={`dep-id-${registrationId}`} value={deploymentId} onChange={(e) => setDeploymentId(e.target.value)} required />
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className="text-xs font-medium" htmlFor={`dep-label-${registrationId}`}>Libellé (optionnel)</label>
          <Input id={`dep-label-${registrationId}`} value={contextLabel} onChange={(e) => setContextLabel(e.target.value)} />
        </div>
        <Button type="submit" size="sm" variant="outline" loading={saving}><Plus size={14} /> Ajouter</Button>
      </form>
      {deployments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun déploiement — un lancement sera rejeté (« deployment inconnu ») tant qu'aucun n'existe.</p>
      ) : (
        <ul className="space-y-1">
          {deployments.map((d) => (
            <li key={d.id} className="text-sm flex items-center justify-between rounded-md border px-3 py-1.5">
              <code>{d.deployment_id}</code>
              <span className="text-muted-foreground text-xs">{d.context_label ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LtiRegistrationRow({ registration, orgId }: { registration: LtiRegistration; orgId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LtiConnectionTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testLtiConnection(registration.id));
    } catch (err) {
      showError(err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-medium">{registration.issuer}</span>
          <span className="text-muted-foreground"> · client_id {registration.client_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{registration.status}</span>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Fermer" : "Gérer"}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" loading={testing} onClick={handleTest}>
                <RadioTower size={14} /> Tester la connexion (JWKS)
              </Button>
              {testResult && (
                <span className="flex items-center gap-1 text-xs" style={{ color: testResult.ok ? "var(--ap-pres)" : "var(--ap-danger)" }}>
                  {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {testResult.ok ? `OK — ${testResult.keyCount} clé(s)` : (testResult.reason ?? "Échec")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Vérification en direct de <code>{registration.jwks_url}</code> — non persistée.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Déploiements</p>
            <LtiDeployments registrationId={registration.id} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Diagnostic — derniers lancements</p>
            <LtiDiagnostics registrationId={registration.id} orgId={orgId} />
          </div>
        </div>
      )}
    </li>
  );
}

function LtiSection({ orgId }: { orgId: string }) {
  const [registrations, setRegistrations] = useState<LtiRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [jwksUrl, setJwksUrl] = useState("");
  const [authLoginUrl, setAuthLoginUrl] = useState("");
  const [authTokenUrl, setAuthTokenUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLtiRegistrations(orgId).then(setRegistrations).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuer.trim() || !clientId.trim() || !jwksUrl.trim() || !authLoginUrl.trim() || !authTokenUrl.trim()) return;
    setSaving(true);
    try {
      const r = await createLtiRegistration({
        orgId, issuer: issuer.trim(), clientId: clientId.trim(),
        jwksUrl: jwksUrl.trim(), authLoginUrl: authLoginUrl.trim(), authTokenUrl: authTokenUrl.trim(),
      });
      setRegistrations((prev) => [r, ...prev]);
      setIssuer(""); setClientId(""); setJwksUrl(""); setAuthLoginUrl(""); setAuthTokenUrl("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>LTI 1.3 (Brivia comme Tool)</h2><p>Enregistrements côté plateforme externe — copiez ces valeurs depuis la configuration LTI de Moodle/Canvas/etc. Deep Linking et grade passback restent des flux serveur non couverts.</p></div>
      </div>
      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2 mb-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-issuer">Issuer</label>
          <Input id="lti-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://plateforme.exemple.edu" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-client">Client ID</label>
          <Input id="lti-client" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-jwks">JWKS URL</label>
          <Input id="lti-jwks" type="url" value={jwksUrl} onChange={(e) => setJwksUrl(e.target.value)} placeholder="https://.../jwks" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-auth-login">Auth login URL</label>
          <Input id="lti-auth-login" type="url" value={authLoginUrl} onChange={(e) => setAuthLoginUrl(e.target.value)} placeholder="https://.../auth" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-auth-token">Auth token URL</label>
          <Input id="lti-auth-token" type="url" value={authTokenUrl} onChange={(e) => setAuthTokenUrl(e.target.value)} placeholder="https://.../token" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" loading={saving}><Plus /> Enregistrer</Button>
        </div>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Plug size={14} /> Aucun enregistrement LTI pour l'instant.</p>
      ) : (
        <ul className="space-y-2" aria-label="Enregistrements LTI">
          {registrations.map((r) => <LtiRegistrationRow key={r.id} registration={r} orgId={orgId} />)}
        </ul>
      )}
    </section>
  );
}

function ApiSection({ orgId }: { orgId: string }) {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listApiClients(orgId).then(setClients).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const c = await createApiClient(orgId, name.trim());
      setClients((prev) => [c, ...prev]);
      setName("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Clients API</h2><p>Identifiants OAuth client-credentials à scopes fins ; aucun jeton utilisateur longue durée.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="client-name">Nom</label>
          <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}><KeyRound /> Créer</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{c.name} · <code>{c.client_id}</code></span>
              <span className="text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WebhookSection({ orgId }: { orgId: string }) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listWebhookEndpoints(orgId).then(setEndpoints).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      const secret = crypto.randomUUID();
      const endpoint = await createWebhookEndpoint(orgId, url.trim(), secret);
      setEndpoints((prev) => [endpoint, ...prev]);
      setUrl("");
      window.alert(`Secret du webhook (affiché une seule fois) : ${secret}`);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Webhooks</h2><p>Livraison signée, horodatée et rejouable ; le secret n'est jamais réaffiché.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[260px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor="webhook-url">URL</label>
          <Input id="webhook-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}><Webhook /> Ajouter</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : (
        <ul className="space-y-2">
          {endpoints.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{e.url}</span>
              <span className="text-muted-foreground">{e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LmsIntegrations() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Intégrations Enterprise", description: "SSO, LTI, API et webhooks." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isAdmin = memberships.some((m) => m.org_id === activeOrgId && m.role === "admin");

  if (loading) {
    return (
      <AppLayout subtitle="Intégrations">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!isAdmin || !activeOrgId) {
    return (
      <AppLayout subtitle="Intégrations">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Seul un administrateur d'établissement configure les intégrations.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Intégrations">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Interopérabilité et identité Enterprise"
          description="SSO, LTI 1.3, API publique et webhooks — connexion de votre identité et de votre LMS."
        />
        <IdentitySection orgId={activeOrgId} />
        <LtiSection orgId={activeOrgId} />
        <ApiSection orgId={activeOrgId} />
        <WebhookSection orgId={activeOrgId} />
      </div>
    </AppLayout>
  );
}
