import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Link2, Plug, Plus, RadioTower, Search, ShieldCheck, Trash2, Webhook, XCircle } from "lucide-react";
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
  buildSsoLoginUrl,
  createApiClient,
  createIdentityClientSecret,
  createIdentityConnection,
  createIdentityDomain,
  createIdentityRoleMapping,
  createLtiDeployment,
  createLtiRegistration,
  createScimGroupRoleMapping,
  createApiToken,
  createWebhookEndpoint,
  deactivateIdentityClientSecret,
  deleteIdentityRoleMapping,
  deleteScimGroupRoleMapping,
  discoverOidcEndpoints,
  linkLtiSubject,
  linkSsoSubject,
  listApiClients,
  listApiTokens,
  listScimGroupRoleMappings,
  revokeApiToken,
  listIdentityClientSecrets,
  listIdentityConnections,
  listIdentityDomains,
  listIdentityRoleMappings,
  listLtiContexts,
  listLtiDeployments,
  listLtiLaunches,
  listLtiNrpsSyncRuns,
  listLtiRegistrations,
  listOneRosterSyncRuns,
  resolveOneRosterUsers,
  commitOneRosterUsers,
  resolveOneRosterClasses,
  commitOneRosterEnrollments,
  startOneRosterSyncRun,
  completeOneRosterSyncRun,
  listSsoLogins,
  listWebhookEndpoints,
  previewSsoRoleMapping,
  samlSpAcsUrl,
  samlSpEntityId,
  samlSpMetadataUrl,
  startSamlTestLogin,
  startSsoTestLogin,
  syncLtiContextRoster,
  testLtiConnection,
  updateIdentityConnection,
  type ApiClient,
  type ApiToken,
  type ScimGroupRoleMapping,
  type IdentityClientSecret,
  type IdentityConnection,
  type IdentityDomain,
  type IdentityRoleMapping,
  type LtiConnectionTestResult,
  type LtiContext,
  type LtiDeployment,
  type LtiLaunch,
  type LtiNrpsSyncRun,
  type LtiRegistration,
  type OneRosterSyncRun,
  type SsoLogin,
  type WebhookEndpoint,
} from "@/lib/lms/integrations";
import { parseSpreadsheetRows } from "@/lib/importSpreadsheet";
import {
  buildOneRosterEnrollmentPreview,
  buildOneRosterUserPreview,
  extractOneRosterEnrollmentRows,
  extractOneRosterUserRows,
  importableOneRosterEnrollmentRows,
  importableOneRosterUserRows,
} from "@/lib/lms/oneRosterImport";
import { exportOneRosterResults, getOneRosterExportSettings, setOneRosterExportSettings } from "@/lib/lms/oneRosterExport";

const ORG_ROLES: IdentityRoleMapping["target_role"][] = ["learner", "trainer", "pedago", "registrar", "admin"];

const SSO_LOGIN_ERROR_LABEL: Record<string, string> = {
  bad_signature_or_claims: "Signature ou revendications invalides",
  nonce_mismatch: "Nonce incohérent (rejeu ?)",
  missing_subject: "Sub/NameID absent",
  missing_code: "Code d'autorisation absent",
  token_exchange_failed: "Échec de l'échange du code (vérifiez client_secret / token endpoint)",
  no_active_secret: "Aucun secret client actif",
  connection_not_configured: "Connexion incomplète (endpoints ou certificat manquants)",
  linked_user_not_found: "Compte lié introuvable",
  session_mint_failed: "Échec de création de session",
  invalid_or_expired_state: "État expiré ou invalide",
  invalid_or_expired_relay_state: "RelayState expiré ou invalide",
  missing_saml_response: "Réponse SAML absente",
  bad_signature_or_cert: "Signature invalide ou certificat non reconnu",
  audience_mismatch: "Audience de l'assertion incorrecte",
  conditions_expired: "Assertion expirée (fenêtre de validité)",
  response_to_mismatch: "InResponseTo incohérent (rejeu ?)",
  idp_error: "Erreur signalée par le fournisseur d'identité",
};

function IdentityDomainsPanel({ orgId, connectionId }: { orgId: string; connectionId: string }) {
  const [domains, setDomains] = useState<IdentityDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listIdentityDomains(connectionId).then(setDomains).catch(showError).finally(() => setLoading(false));
  }, [connectionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setSaving(true);
    try {
      const d = await createIdentityDomain(orgId, connectionId, domain.trim());
      setDomains((prev) => [d, ...prev]);
      setDomain("");
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
          <label className="text-xs font-medium" htmlFor={`domain-${connectionId}`}>Domaine (mode « obligatoire pour les domaines gérés »)</label>
          <Input id={`domain-${connectionId}`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="exemple.edu" required />
        </div>
        <Button type="submit" size="sm" variant="outline" loading={saving}><Plus size={14} /> Ajouter</Button>
      </form>
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun domaine — le mode « obligatoire pour les domaines gérés » n'aura aucun effet tant qu'aucun n'est ajouté.</p>
      ) : (
        <ul className="space-y-1">
          {domains.map((d) => <li key={d.id} className="text-sm rounded-md border px-3 py-1.5"><code>{d.domain}</code></li>)}
        </ul>
      )}
    </div>
  );
}

function IdentitySecretsPanel({ connectionId }: { connectionId: string }) {
  const [secrets, setSecrets] = useState<IdentityClientSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [plaintext, setPlaintext] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = () => listIdentityClientSecrets(connectionId).then(setSecrets).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [connectionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plaintext.trim()) return;
    setSaving(true);
    try {
      await createIdentityClientSecret(connectionId, plaintext.trim());
      setPlaintext("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateIdentityClientSecret(id);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <ListSkeleton rows={1} withAvatar={false} />;

  return (
    <div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-2">
        <div className="min-w-[260px] flex-1 space-y-1">
          <label className="text-xs font-medium" htmlFor={`secret-${connectionId}`}>Client secret (fourni par le fournisseur)</label>
          <Input id={`secret-${connectionId}`} type="password" value={plaintext} onChange={(e) => setPlaintext(e.target.value)} placeholder="Jamais réaffiché après création" />
        </div>
        <Button type="submit" size="sm" variant="outline" loading={saving}><KeyRound size={14} /> Enregistrer</Button>
      </form>
      {secrets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun secret — l'échange de code échouera tant qu'aucun secret actif n'existe.</p>
      ) : (
        <ul className="space-y-1">
          {secrets.map((s) => (
            <li key={s.id} className="text-sm flex items-center justify-between rounded-md border px-3 py-1.5">
              <span>v{s.version} · {s.is_active ? <span style={{ color: "var(--ap-pres)" }}>actif</span> : <span className="text-muted-foreground">désactivé</span>}</span>
              {s.is_active && (
                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id)}>
                  <Trash2 size={14} /> Désactiver
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-1">INT-005 : gardez l'ancien secret actif jusqu'à confirmation que le nouveau fonctionne (fenêtre de chevauchement) — sso-callback essaie chaque secret actif.</p>
    </div>
  );
}

function RoleMappingPanel({ orgId, connectionId }: { orgId: string; connectionId: string }) {
  const [mappings, setMappings] = useState<IdentityRoleMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [attributePath, setAttributePath] = useState("");
  const [matchValue, setMatchValue] = useState("");
  const [targetRole, setTargetRole] = useState<IdentityRoleMapping["target_role"]>("learner");
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState('{\n  "groups": ["staff"]\n}');
  const [previewResult, setPreviewResult] = useState<string[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const reload = () => listIdentityRoleMappings(connectionId).then(setMappings).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [connectionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attributePath.trim() || !matchValue.trim()) return;
    setSaving(true);
    try {
      await createIdentityRoleMapping(orgId, connectionId, { attributePath: attributePath.trim(), matchValue: matchValue.trim(), targetRole, priority: mappings.length });
      setAttributePath(""); setMatchValue("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIdentityRoleMapping(id);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const parsed = JSON.parse(sample);
      setPreviewResult(await previewSsoRoleMapping(connectionId, parsed));
    } catch (err) {
      showError(err);
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) return <ListSkeleton rows={1} withAvatar={false} />;

  return (
    <div>
      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-4 mb-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`map-attr-${connectionId}`}>Attribut (clé du jeton)</label>
          <Input id={`map-attr-${connectionId}`} value={attributePath} onChange={(e) => setAttributePath(e.target.value)} placeholder="groups" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`map-value-${connectionId}`}>Valeur attendue</label>
          <Input id={`map-value-${connectionId}`} value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="staff" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`map-role-${connectionId}`}>Rôle accordé</label>
          <select
            id={`map-role-${connectionId}`}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as IdentityRoleMapping["target_role"])}
          >
            {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" variant="outline" loading={saving}><Plus size={14} /> Ajouter la règle</Button>
        </div>
      </form>
      {mappings.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-2">Aucune règle — une connexion réussie n'accordera aucun rôle supplémentaire.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {mappings.map((m) => (
            <li key={m.id} className="text-sm flex items-center justify-between rounded-md border px-3 py-1.5">
              <span>Si <code>{m.attribute_path}</code> = <code>{m.match_value}</code> → <strong>{m.target_role}</strong></span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}><Trash2 size={14} /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-md border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">INT-004 — Prévisualiser avant activation</p>
        <textarea
          className="w-full rounded-md border p-2 text-xs font-mono"
          style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)", minHeight: 90 }}
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          aria-label="Payload d'attributs d'exemple (JSON)"
        />
        <div className="flex items-center gap-2 mt-2">
          <Button variant="outline" size="sm" loading={previewing} onClick={handlePreview}><Search size={14} /> Prévisualiser</Button>
          {previewResult && (
            <span className="text-sm">
              {previewResult.length === 0 ? "Aucun rôle accordé par cet exemple" : <>Rôles résolus : <strong>{previewResult.join(", ")}</strong></>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SsoLinkSubjectForm({ connectionId, subject, orgId, members, onLinked }: {
  connectionId: string; subject: string; orgId: string; members: OrgMember[]; onLinked: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLink = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await linkSsoSubject(connectionId, subject, userId);
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

function IdentityDiagnostics({ connectionId, orgId }: { connectionId: string; orgId: string }) {
  const [logins, setLogins] = useState<SsoLogin[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => listSsoLogins(connectionId).then(setLogins).catch(showError).finally(() => setLoading(false));
  useEffect(() => {
    reload();
    listOrgMembers(orgId).then(setMembers).catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, orgId]);

  if (loading) return <TableSkeleton rows={2} cols={3} />;
  if (logins.length === 0) return <p className="text-sm text-muted-foreground">Aucune connexion journalisée pour l'instant.</p>;

  return (
    <ul className="space-y-2" aria-label="Connexions SSO">
      {logins.map((l) => {
        const unlinked = l.status === "success" && !l.user_id && l.external_subject;
        return (
          <li key={l.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                {l.status === "success" ? <CheckCircle2 size={14} style={{ color: "var(--ap-pres)" }} /> : <XCircle size={14} style={{ color: "var(--ap-danger)" }} />}
                {l.status === "success" ? (l.user_id ? "Lié" : "Non relié") : (SSO_LOGIN_ERROR_LABEL[l.error_reason ?? ""] ?? l.error_reason ?? "Rejeté")}
              </span>
              <span className="text-muted-foreground text-xs">{new Date(l.logged_at).toLocaleString("fr-FR")}</span>
            </div>
            {l.external_subject && <p className="text-muted-foreground text-xs mt-1">sub : <code>{l.external_subject}</code></p>}
            {unlinked && (
              <SsoLinkSubjectForm connectionId={connectionId} subject={l.external_subject!} orgId={orgId} members={members} onLinked={reload} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** SP metadata is static and connection-independent (see saml-metadata's
 *  header) — shown once per connection's expanded panel purely as a
 *  copy-paste convenience for whichever IdP config screen the admin has
 *  open, not fetched from the connection row itself. */
function SamlSpMetadataPanel() {
  return (
    <div className="rounded-md border p-3 space-y-1.5 text-xs">
      <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-1">Métadonnées SP — à coller côté fournisseur</p>
      <p>Entity ID : <code className="break-all">{samlSpEntityId()}</code></p>
      <p>ACS URL (Assertion Consumer Service) : <code className="break-all">{samlSpAcsUrl()}</code></p>
      <p>Métadonnées XML complètes : <code className="break-all">{samlSpMetadataUrl()}</code></p>
      <p className="text-muted-foreground">NameID format : email · liaison ACS : HTTP-POST · pas de clé de signature SP (les requêtes ne sont pas signées, voir _shared/saml.ts)</p>
    </div>
  );
}

function IdentityConnectionRow({ connection, orgId, onUpdated }: { connection: IdentityConnection; orgId: string; onUpdated: (c: IdentityConnection) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isSaml = connection.protocol === "saml";
  const [issuer, setIssuer] = useState((connection.metadata.issuer as string) ?? "");
  const [clientId, setClientId] = useState((connection.metadata.client_id as string) ?? "");
  const [authorizationEndpoint, setAuthorizationEndpoint] = useState((connection.metadata.authorization_endpoint as string) ?? "");
  const [tokenEndpoint, setTokenEndpoint] = useState((connection.metadata.token_endpoint as string) ?? "");
  const [jwksUri, setJwksUri] = useState((connection.metadata.jwks_uri as string) ?? "");
  const [idpEntityId, setIdpEntityId] = useState((connection.metadata.idp_entity_id as string) ?? "");
  const [idpSsoUrl, setIdpSsoUrl] = useState((connection.metadata.idp_sso_url as string) ?? "");
  const [idpCert, setIdpCert] = useState((connection.metadata.idp_cert as string) ?? "");
  const [discovering, setDiscovering] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleDiscover = async () => {
    if (!issuer.trim()) return;
    setDiscovering(true);
    try {
      const doc = await discoverOidcEndpoints(orgId, issuer.trim());
      setAuthorizationEndpoint(doc.authorization_endpoint);
      setTokenEndpoint(doc.token_endpoint);
      setJwksUri(doc.jwks_uri);
    } catch (err) {
      showError(err);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await updateIdentityConnection(connection.id, {
        metadata: isSaml
          ? { ...connection.metadata, idp_entity_id: idpEntityId.trim(), idp_sso_url: idpSsoUrl.trim(), idp_cert: idpCert.trim() }
          : { ...connection.metadata, issuer: issuer.trim(), client_id: clientId.trim(), authorization_endpoint: authorizationEndpoint.trim(), token_endpoint: tokenEndpoint.trim(), jwks_uri: jwksUri.trim() },
      });
      onUpdated(updated);
    } catch (err) {
      showError(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleModeChange = async (mode: IdentityConnection["mode"]) => {
    try {
      onUpdated(await updateIdentityConnection(connection.id, { mode }));
    } catch (err) {
      showError(err);
    }
  };

  const handleStatusChange = async (status: IdentityConnection["status"]) => {
    try {
      onUpdated(await updateIdentityConnection(connection.id, { status }));
    } catch (err) {
      showError(err);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const url = isSaml
        ? await startSamlTestLogin(connection.id, window.location.origin + "/dashboard")
        : await startSsoTestLogin(connection.id, window.location.origin + "/dashboard");
      window.location.href = url;
    } catch (err) {
      showError(err);
      setTesting(false);
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-medium">{connection.display_name}</span>
          <span className="text-muted-foreground"> · {isSaml ? "SAML" : "OIDC"} · {connection.mode}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
            value={connection.status}
            onChange={(e) => handleStatusChange(e.target.value as IdentityConnection["status"])}
            aria-label={`Statut de ${connection.display_name}`}
          >
            <option value="draft">draft</option>
            <option value="testing">testing</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>{expanded ? "Fermer" : "Gérer"}</Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-4">
          {isSaml ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Configuration SAML</p>
              <div className="grid gap-2 sm:grid-cols-2 mb-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`idp-eid-${connection.id}`}>IdP Entity ID</label>
                  <Input id={`idp-eid-${connection.id}`} value={idpEntityId} onChange={(e) => setIdpEntityId(e.target.value)} placeholder="https://idp.exemple.edu/saml" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`idp-sso-${connection.id}`}>IdP SSO URL (HTTP-Redirect)</label>
                  <Input id={`idp-sso-${connection.id}`} value={idpSsoUrl} onChange={(e) => setIdpSsoUrl(e.target.value)} placeholder="https://idp.exemple.edu/sso" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium" htmlFor={`idp-cert-${connection.id}`}>Certificat de signature IdP (x509, PEM)</label>
                  <textarea
                    id={`idp-cert-${connection.id}`}
                    className="w-full rounded-md border p-2 text-xs font-mono"
                    style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)", minHeight: 90 }}
                    value={idpCert}
                    onChange={(e) => setIdpCert(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`mode-${connection.id}`}>Mode d'activation (INT-002)</label>
                  <select
                    id={`mode-${connection.id}`}
                    className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                    style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
                    value={connection.mode}
                    onChange={(e) => handleModeChange(e.target.value as IdentityConnection["mode"])}
                  >
                    <option value="optional">optionnel</option>
                    <option value="required_for_domains">obligatoire pour les domaines gérés</option>
                    <option value="admin_bypass">secours administrateur</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Button variant="outline" size="sm" loading={savingConfig} onClick={handleSaveConfig}>Enregistrer la configuration</Button>
                {connection.status === "testing" && (
                  <Button variant="outline" size="sm" loading={testing} onClick={handleTest}>
                    <ShieldCheck size={14} /> Tester la connexion (login réel, admin seulement)
                  </Button>
                )}
              </div>
              <SamlSpMetadataPanel />
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Configuration OIDC</p>
              <div className="grid gap-2 sm:grid-cols-2 mb-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`iss-${connection.id}`}>Issuer</label>
                  <div className="flex gap-1">
                    <Input id={`iss-${connection.id}`} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://idp.exemple.edu" />
                    <Button type="button" variant="outline" size="sm" loading={discovering} onClick={handleDiscover}><Search size={14} /> Découvrir</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`cid-${connection.id}`}>Client ID</label>
                  <Input id={`cid-${connection.id}`} value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`az-${connection.id}`}>Authorization endpoint</label>
                  <Input id={`az-${connection.id}`} value={authorizationEndpoint} onChange={(e) => setAuthorizationEndpoint(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`tok-${connection.id}`}>Token endpoint</label>
                  <Input id={`tok-${connection.id}`} value={tokenEndpoint} onChange={(e) => setTokenEndpoint(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`jwks-${connection.id}`}>JWKS URI</label>
                  <Input id={`jwks-${connection.id}`} value={jwksUri} onChange={(e) => setJwksUri(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`mode-${connection.id}`}>Mode d'activation (INT-002)</label>
                  <select
                    id={`mode-${connection.id}`}
                    className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                    style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
                    value={connection.mode}
                    onChange={(e) => handleModeChange(e.target.value as IdentityConnection["mode"])}
                  >
                    <option value="optional">optionnel</option>
                    <option value="required_for_domains">obligatoire pour les domaines gérés</option>
                    <option value="admin_bypass">secours administrateur</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" loading={savingConfig} onClick={handleSaveConfig}>Enregistrer la configuration</Button>
                {connection.status === "testing" && (
                  <Button variant="outline" size="sm" loading={testing} onClick={handleTest}>
                    <ShieldCheck size={14} /> Tester la connexion (login réel, admin seulement)
                  </Button>
                )}
              </div>
            </div>
          )}
          {!isSaml && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Client secret</p>
              <IdentitySecretsPanel connectionId={connection.id} />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Domaines</p>
            <IdentityDomainsPanel orgId={orgId} connectionId={connection.id} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Mapping attributs → rôles</p>
            <RoleMappingPanel orgId={orgId} connectionId={connection.id} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Diagnostic — dernières connexions</p>
            <IdentityDiagnostics connectionId={connection.id} orgId={orgId} />
          </div>
        </div>
      )}
    </li>
  );
}

function IdentitySection({ orgId }: { orgId: string }) {
  const [connections, setConnections] = useState<IdentityConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<IdentityConnection["protocol"]>("oidc");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listIdentityConnections(orgId).then(setConnections).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const c = await createIdentityConnection(orgId, protocol, name.trim());
      setConnections((prev) => [c, ...prev]);
      setName("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdated = (updated: IdentityConnection) => {
    setConnections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>SSO (OIDC / SAML)</h2><p>Connexion d'identité par organisation — brouillon → test (login réel réservé à l'admin) → actif.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[220px] space-y-1">
          <label className="text-sm font-medium" htmlFor="idp-name">Nom du fournisseur</label>
          <Input id="idp-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="min-w-[140px] space-y-1">
          <label className="text-sm font-medium" htmlFor="idp-protocol">Protocole</label>
          <select
            id="idp-protocol"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as IdentityConnection["protocol"])}
          >
            <option value="oidc">OIDC</option>
            <option value="saml">SAML</option>
          </select>
        </div>
        <Button type="submit" size="sm" loading={saving}><Plus /> Ajouter</Button>
      </form>
      {loading ? <TableSkeleton rows={2} cols={2} /> : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Plug size={14} /> Aucune connexion SSO pour l'instant.</p>
      ) : (
        <ul className="space-y-2" aria-label="Connexions SSO">
          {connections.map((c) => <IdentityConnectionRow key={c.id} connection={c} orgId={orgId} onUpdated={handleUpdated} />)}
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
  missing_deep_linking_settings: "Requête Deep Linking incomplète (deep_link_return_url absent)",
  deep_linking_session_failed: "Échec de préparation de la sélection de contenu",
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

/** LTI-003: contexts (external courses/classes) this registration has been
 *  launched from with NRPS roster access granted. A context only appears
 *  here once the platform has actually sent a namesroleservice claim on some
 *  launch — nothing to sync before that. Sync is always admin-triggered,
 *  never automatic (see lti-nrps-sync/index.ts's header). */
function LtiContexts({ registrationId }: { registrationId: string }) {
  const [contexts, setContexts] = useState<LtiContext[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLtiContexts(registrationId).then(setContexts).catch(showError).finally(() => setLoading(false));
  }, [registrationId]);

  if (loading) return <ListSkeleton rows={1} withAvatar={false} />;

  if (contexts.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun contexte avec accès au répertoire — un lancement doit d'abord accorder le NRPS pour qu'un contexte apparaisse ici.</p>;
  }

  return (
    <ul className="space-y-2">
      {contexts.map((c) => <LtiContextRow key={c.id} context={c} />)}
    </ul>
  );
}

function LtiContextRow({ context }: { context: LtiContext }) {
  const [runs, setRuns] = useState<LtiNrpsSyncRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadRuns = () => {
    setLoadingRuns(true);
    listLtiNrpsSyncRuns(context.id).then(setRuns).catch(showError).finally(() => setLoadingRuns(false));
  };

  useEffect(loadRuns, [context.id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Result surfaces via the "Dernière synchro" line below once loadRuns()
      // refreshes — no separate toast needed, showError is for errors only.
      await syncLtiContextRoster(context.id);
      loadRuns();
    } catch (err) {
      showError(err);
    } finally {
      setSyncing(false);
    }
  };

  const lastRun = runs[0];

  return (
    <li className="rounded-md border px-3 py-2 text-sm space-y-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-medium">{context.title ?? context.context_external_id}</span>
          <span className="text-muted-foreground text-xs"> · {context.context_external_id}</span>
        </div>
        <Button
          variant="outline" size="sm" loading={syncing}
          disabled={!context.context_memberships_url}
          onClick={handleSync}
        >
          <RadioTower size={14} /> Synchroniser le répertoire
        </Button>
      </div>
      {loadingRuns ? null : lastRun ? (
        <p className="text-xs text-muted-foreground">
          Dernière synchro {new Date(lastRun.started_at).toLocaleString()} — {lastRun.status === "completed"
            ? `${lastRun.matched_count} apparié(s), ${lastRun.unmatched_count} non apparié(s)`
            : lastRun.status === "failed" ? `échec (${lastRun.error_reason ?? "raison inconnue"})` : "en cours…"}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune synchronisation encore lancée.</p>
      )}
    </li>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Répertoire des contextes (NRPS)</p>
            <LtiContexts registrationId={registration.id} />
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

/** SCIM 2.0 (spec 04, SCM-001→004) client detail — token issuance (bearer
 *  tokens an IdP presents on /scim-users, /scim-groups) and group→role
 *  mapping (SCM-004), scoped to one api_clients row acting as the SCIM
 *  connection. Collapsed by default: most orgs have very few API clients,
 *  no need for every row to show its full token/mapping management inline
 *  before an admin asks for it. */
function ApiClientDetail({ client }: { client: ApiClient }) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [mappings, setMappings] = useState<ScimGroupRoleMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenLabel, setTokenLabel] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [justIssued, setJustIssued] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupRole, setGroupRole] = useState<ScimGroupRoleMapping["target_role"]>("learner");
  const [mappingSaving, setMappingSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listApiTokens(client.id), listScimGroupRoleMappings(client.id)])
      .then(([t, m]) => { setTokens(t); setMappings(m); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const handleIssueToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    try {
      const plaintext = await createApiToken(client.id, tokenLabel.trim(), []);
      setJustIssued(plaintext);
      setTokenLabel("");
      load();
    } catch (err) {
      showError(err);
    } finally {
      setIssuing(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    try {
      await revokeApiToken(id);
      load();
    } catch (err) {
      showError(err);
    }
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setMappingSaving(true);
    try {
      const m = await createScimGroupRoleMapping(client.id, groupName.trim(), groupRole);
      setMappings((prev) => [m, ...prev]);
      setGroupName("");
    } catch (err) {
      showError(err);
    } finally {
      setMappingSaving(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await deleteScimGroupRoleMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      showError(err);
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span>{client.name} · <code>{client.client_id}</code></span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{client.status}</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Masquer" : "Gérer SCIM"}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-4 border-t pt-3">
          <div>
            <h3 className="text-sm font-medium mb-2">Jetons SCIM (SCM-002)</h3>
            {justIssued && (
              <div className="mb-2 rounded-md border border-amber-400 bg-amber-50 p-2 text-xs">
                Jeton (affiché une seule fois) : <code className="break-all">{justIssued}</code>
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => setJustIssued(null)}>Fermer</Button>
              </div>
            )}
            <form onSubmit={handleIssueToken} className="flex flex-wrap items-end gap-2 mb-2">
              <Input placeholder="Libellé (ex. Okta)" value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} className="max-w-[220px]" />
              <Button type="submit" size="sm" loading={issuing}><KeyRound size={14} /> Générer</Button>
            </form>
            {loading ? <ListSkeleton rows={2} /> : (
              <ul className="space-y-1">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-xs">
                    <span>{t.label ?? "(sans libellé)"} — {t.revoked_at ? "révoqué" : "actif"}</span>
                    {!t.revoked_at && <Button variant="ghost" size="sm" onClick={() => handleRevokeToken(t.id)}><Trash2 size={12} /></Button>}
                  </li>
                ))}
                {tokens.length === 0 && <li className="text-muted-foreground text-xs">Aucun jeton.</li>}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Mapping groupe SCIM → rôle (SCM-004)</h3>
            <form onSubmit={handleAddMapping} className="flex flex-wrap items-end gap-2 mb-2">
              <Input placeholder="Nom du groupe (displayName)" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="max-w-[220px]" required />
              <select className="border rounded-md px-2 py-1.5 text-sm" value={groupRole} onChange={(e) => setGroupRole(e.target.value as ScimGroupRoleMapping["target_role"])}>
                {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button type="submit" size="sm" loading={mappingSaving}><Plus size={14} /> Ajouter</Button>
            </form>
            <ul className="space-y-1">
              {mappings.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-xs">
                  <span>{m.group_display_name} → {m.target_role}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteMapping(m.id)}><Trash2 size={12} /></Button>
                </li>
              ))}
              {mappings.length === 0 && <li className="text-muted-foreground text-xs">Aucun mapping — les membres de groupe SCIM sans règle ne reçoivent aucun rôle.</li>}
            </ul>
          </div>
        </div>
      )}
    </li>
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
        <div><h2>Clients API &amp; SCIM 2.0</h2><p>Identifiants OAuth client-credentials à scopes fins ; un client peut aussi porter des jetons SCIM (provisioning Users/Groups, SCM-001→004) pour un IdP externe.</p></div>
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
          {clients.map((c) => <ApiClientDetail key={c.id} client={c} />)}
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

/** OneRoster 1.2 (spec 04, ROS-001→005, 20260821060000_oneroster.sql).
 *  CSV dry-run import for users.csv/enrollments.csv (real preview before
 *  any write, mirroring EnrollmentImportDialog's established shape),
 *  sync-run history, and outbound export settings. Enrollment sync stays
 *  CSV-only (see the migration's file header for why REST-inbound is
 *  scoped to users only in this pass — enroll_in_session()/
 *  transition_enrollment() both require a real admin session). */
function OneRosterSection({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<OneRosterSyncRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [userPreview, setUserPreview] = useState<ReturnType<typeof buildOneRosterUserPreview>>([]);
  const [enrollmentPreview, setEnrollmentPreview] = useState<ReturnType<typeof buildOneRosterEnrollmentPreview>>([]);
  const [importing, setImporting] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [exportSaving, setExportSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([listOneRosterSyncRuns(orgId), getOneRosterExportSettings(orgId)])
      .then(([r, settings]) => { setRuns(r); setExportEnabled(settings?.enabled ?? false); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [open, orgId]);

  const handleUsersFile = async (file: File) => {
    try {
      const raw = await parseSpreadsheetRows(file);
      const rows = extractOneRosterUserRows(raw);
      const resolved = await resolveOneRosterUsers(orgId, rows.map((r) => ({ sourced_id: r.sourced_id, email: r.email })));
      setUserPreview(buildOneRosterUserPreview(rows, resolved));
    } catch (err) {
      showError(err);
    }
  };

  const handleEnrollmentsFile = async (file: File) => {
    try {
      const raw = await parseSpreadsheetRows(file);
      const rows = extractOneRosterEnrollmentRows(raw);
      const userSourcedIds = [...new Set(rows.map((r) => r.user_sourced_id))];
      const classSourcedIds = [...new Set(rows.map((r) => r.class_sourced_id))];
      const [resolvedUsers, resolvedClasses] = await Promise.all([
        resolveOneRosterUsers(orgId, userSourcedIds.map((id) => ({ sourced_id: id, email: id }))),
        resolveOneRosterClasses(orgId, classSourcedIds.map((code) => ({ sourced_id: code, class_code: code }))),
      ]);
      // Enrollments.csv identifies people/classes by sourcedId, not email —
      // resolveOneRosterUsers() only matches by email, so a userSourcedId
      // only resolves here if it was already committed via users.csv first
      // (external_mappings lookup, not a fresh email match). Build the map
      // from whichever of the two actually has a Brivia match.
      const userMap = new Map(resolvedUsers.filter((u) => u.matched).map((u) => [u.sourced_id, u.learner_id as string]));
      const classMap = new Map(resolvedClasses.filter((c) => c.matched).map((c) => [c.sourced_id, c.session_id as string]));
      setEnrollmentPreview(buildOneRosterEnrollmentPreview(rows, userMap, classMap));
    } catch (err) {
      showError(err);
    }
  };

  const commitUsers = async () => {
    const rows = importableOneRosterUserRows(userPreview);
    if (rows.length === 0) return;
    setImporting(true);
    const runId = await startOneRosterSyncRun(orgId, "csv").catch(() => null);
    try {
      const results = await commitOneRosterUsers(orgId, rows);
      const created = results.filter((r) => r.outcome === "created").length;
      const updated = results.filter((r) => r.outcome === "updated").length;
      if (runId) await completeOneRosterSyncRun(runId, "completed", created, updated, 0, 0, null);
      setUserPreview([]);
      setRuns(await listOneRosterSyncRuns(orgId));
    } catch (err) {
      if (runId) await completeOneRosterSyncRun(runId, "failed", 0, 0, 0, rows.length, err instanceof Error ? err.message : "error");
      showError(err);
    } finally {
      setImporting(false);
    }
  };

  const commitEnrollments = async () => {
    const rows = importableOneRosterEnrollmentRows(enrollmentPreview).map((r) => ({ ...r, status: r.status }));
    if (rows.length === 0) return;
    setImporting(true);
    const runId = await startOneRosterSyncRun(orgId, "csv").catch(() => null);
    try {
      const results = await commitOneRosterEnrollments(orgId, rows);
      const active = results.filter((r) => r.outcome === "active").length;
      const deactivated = results.filter((r) => r.outcome === "deactivated").length;
      if (runId) await completeOneRosterSyncRun(runId, "completed", active, 0, deactivated, 0, null);
      setEnrollmentPreview([]);
      setRuns(await listOneRosterSyncRuns(orgId));
    } catch (err) {
      if (runId) await completeOneRosterSyncRun(runId, "failed", 0, 0, 0, rows.length, err instanceof Error ? err.message : "error");
      showError(err);
    } finally {
      setImporting(false);
    }
  };

  const toggleExport = async (enabled: boolean) => {
    setExportSaving(true);
    try {
      await setOneRosterExportSettings(orgId, enabled, []);
      setExportEnabled(enabled);
    } catch (err) {
      showError(err);
    } finally {
      setExportSaving(false);
    }
  };

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4 flex items-center justify-between">
        <div><h2>OneRoster 1.2</h2><p>Import CSV (utilisateurs, inscriptions) avec aperçu dry-run ; export gradebook sortant.</p></div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Masquer" : "Gérer OneRoster"}</Button>
      </div>
      {open && (loading ? <ListSkeleton rows={3} /> : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Import users.csv (ROS-001)</h3>
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleUsersFile(e.target.files[0])} className="text-sm" />
            {userPreview.length > 0 && (
              <div className="mt-2 space-y-2">
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {userPreview.map((r) => (
                    <li key={r.rowIndex} className="flex justify-between gap-2">
                      <span>{r.email}</span>
                      <span className={r.outcomeStatus === "ok" ? "text-emerald-600" : "text-amber-600"}>{r.outcomeStatus}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" loading={importing} onClick={commitUsers}>Importer {importableOneRosterUserRows(userPreview).length} ligne(s)</Button>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Import enrollments.csv (ROS-001) — inscrit ou désinscrit sans supprimer l'historique (ROS-004)</h3>
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleEnrollmentsFile(e.target.files[0])} className="text-sm" />
            {enrollmentPreview.length > 0 && (
              <div className="mt-2 space-y-2">
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {enrollmentPreview.map((r) => (
                    <li key={r.rowIndex} className="flex justify-between gap-2">
                      <span>{r.userSourcedId} → {r.classSourcedId}</span>
                      <span className={r.outcomeStatus === "ok" ? "text-emerald-600" : "text-amber-600"}>{r.outcomeStatus}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" loading={importing} onClick={commitEnrollments}>Synchroniser {importableOneRosterEnrollmentRows(enrollmentPreview).length} ligne(s)</Button>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Export gradebook sortant (ROS-005)</h3>
            <div className="flex items-center gap-2">
              <Button variant={exportEnabled ? "default" : "outline"} size="sm" loading={exportSaving} onClick={() => toggleExport(!exportEnabled)}>
                {exportEnabled ? "Activé pour cette organisation" : "Désactivé"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportOneRosterResults(orgId).catch(showError)} disabled={!exportEnabled}>
                Télécharger results.csv
              </Button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Historique des synchronisations</h3>
            <ul className="space-y-1 text-xs">
              {runs.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 rounded border p-2">
                  <span>{r.source} · {new Date(r.started_at).toLocaleString()}</span>
                  <span>{r.status} — {r.created_count} créés, {r.updated_count} maj, {r.deactivated_count} désactivés{r.error_count ? `, ${r.error_count} erreurs` : ""}</span>
                </li>
              ))}
              {runs.length === 0 && <li className="text-muted-foreground">Aucune synchronisation encore.</li>}
            </ul>
          </div>
        </div>
      ))}
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
        <OneRosterSection orgId={activeOrgId} />
        <WebhookSection orgId={activeOrgId} />
      </div>
    </AppLayout>
  );
}
