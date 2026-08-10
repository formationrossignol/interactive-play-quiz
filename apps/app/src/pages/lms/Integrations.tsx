import { useEffect, useState } from "react";
import { KeyRound, Plus, Webhook } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  createApiClient,
  createIdentityConnection,
  createLtiRegistration,
  createWebhookEndpoint,
  listApiClients,
  listIdentityConnections,
  listLtiRegistrations,
  listWebhookEndpoints,
  type ApiClient,
  type IdentityConnection,
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

function LtiSection({ orgId }: { orgId: string }) {
  const [registrations, setRegistrations] = useState<LtiRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLtiRegistrations(orgId).then(setRegistrations).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuer.trim() || !clientId.trim()) return;
    setSaving(true);
    try {
      const r = await createLtiRegistration({
        orgId, issuer: issuer.trim(), clientId: clientId.trim(),
        jwksUrl: `${issuer.trim()}/.well-known/jwks.json`,
        authLoginUrl: `${issuer.trim()}/auth`,
        authTokenUrl: `${issuer.trim()}/token`,
      });
      setRegistrations((prev) => [r, ...prev]);
      setIssuer(""); setClientId("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>LTI 1.3 (Brivia comme Tool)</h2><p>Enregistrements côté plateforme externe. Deep Linking et grade passback restent des flux serveur.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-issuer">Issuer</label>
          <Input id="lti-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} required />
        </div>
        <div className="min-w-[180px] space-y-1">
          <label className="text-sm font-medium" htmlFor="lti-client">Client ID</label>
          <Input id="lti-client" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={saving}><Plus /> Enregistrer</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : (
        <ul className="space-y-2">
          {registrations.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{r.issuer}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </li>
          ))}
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
