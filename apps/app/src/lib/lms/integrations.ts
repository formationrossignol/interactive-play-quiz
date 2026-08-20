import { supabase, supabaseUrl } from '@/lib/supabase';

export interface IdentityConnection {
  id: string;
  org_id: string;
  protocol: 'oidc' | 'saml';
  display_name: string;
  status: 'draft' | 'testing' | 'active' | 'disabled';
  mode: 'optional' | 'required_for_domains' | 'admin_bypass';
  /** OIDC config lives here (issuer/client_id/authorization_endpoint/
   *  token_endpoint/jwks_uri/scope) — no client_secret, that's vault-backed
   *  (see identity_client_secrets / createIdentityClientSecret below). */
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface IdentityDomain {
  id: string;
  org_id: string;
  connection_id: string;
  domain: string;
  verified_at: string | null;
  created_at: string;
}

export interface IdentityClientSecret {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface IdentityRoleMapping {
  id: string;
  connection_id: string;
  attribute_path: string;
  match_value: string;
  target_role: 'learner' | 'trainer' | 'pedago' | 'registrar' | 'admin';
  priority: number;
}

export interface SsoLogin {
  id: string;
  connection_id: string;
  external_subject: string | null;
  user_id: string | null;
  status: 'success' | 'rejected';
  error_reason: string | null;
  logged_at: string;
}

export interface LtiRegistration {
  id: string;
  org_id: string;
  issuer: string;
  client_id: string;
  jwks_url: string;
  auth_login_url: string;
  auth_token_url: string;
  status: 'draft' | 'active' | 'disabled';
  created_at: string;
}

export interface LtiDeployment {
  id: string;
  registration_id: string;
  deployment_id: string;
  context_label: string | null;
  created_at: string;
}

export interface LtiLaunch {
  id: string;
  registration_id: string;
  deployment_id: string | null;
  subject: string | null;
  nonce: string | null;
  user_id: string | null;
  status: 'success' | 'rejected';
  error_reason: string | null;
  launched_at: string;
}

export interface ApiClient {
  id: string;
  org_id: string;
  name: string;
  client_id: string;
  scopes: string[];
  status: 'active' | 'revoked';
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  status: 'active' | 'disabled';
  created_at: string;
}

export async function listIdentityConnections(orgId: string): Promise<IdentityConnection[]> {
  const { data, error } = await supabase.from('identity_connections').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdentityConnection[];
}

export async function createIdentityConnection(orgId: string, protocol: 'oidc' | 'saml', displayName: string): Promise<IdentityConnection> {
  const { data, error } = await supabase.from('identity_connections').insert({ org_id: orgId, protocol, display_name: displayName }).select().single();
  if (error) throw error;
  return data as IdentityConnection;
}

/** RLS on identity_connections is admin `for all` — direct writes are fine,
 *  no RPC needed for non-secret config (issuer/client_id/endpoints/mode). */
export async function updateIdentityConnection(id: string, patch: Partial<Pick<IdentityConnection, 'display_name' | 'status' | 'mode' | 'metadata'>>): Promise<IdentityConnection> {
  const { data, error } = await supabase.from('identity_connections').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as IdentityConnection;
}

/** Server-side fetch of `<issuer>/.well-known/openid-configuration` — avoids
 *  depending on the IdP's own CORS policy for a direct browser fetch. */
export async function discoverOidcEndpoints(orgId: string, issuer: string): Promise<{ issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }> {
  const { data, error } = await supabase.functions.invoke('sso-discover-oidc', { body: { orgId, issuer } });
  if (error) throw error;
  return data;
}

export async function listIdentityDomains(connectionId: string): Promise<IdentityDomain[]> {
  const { data, error } = await supabase.from('identity_domains').select('*').eq('connection_id', connectionId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdentityDomain[];
}

export async function createIdentityDomain(orgId: string, connectionId: string, domain: string): Promise<IdentityDomain> {
  const { data, error } = await supabase.from('identity_domains').insert({ org_id: orgId, connection_id: connectionId, domain }).select().single();
  if (error) throw error;
  return data as IdentityDomain;
}

/** Plaintext never touches identity_client_secrets — create_identity_client_secret()
 *  hashes/encrypts it into the vault server-side, only a metadata row (id/
 *  version/is_active) comes back. Rotation: call again, then
 *  deactivateIdentityClientSecret() the old one once the new one is
 *  confirmed live (INT-005's overlap window — sso-callback tries every
 *  active secret, so both validate until the old one is deactivated). */
export async function createIdentityClientSecret(connectionId: string, plaintext: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_identity_client_secret', { p_connection_id: connectionId, p_plaintext: plaintext });
  if (error) throw error;
  return data as string;
}

export async function listIdentityClientSecrets(connectionId: string): Promise<IdentityClientSecret[]> {
  const { data, error } = await supabase.rpc('list_identity_client_secrets', { p_connection_id: connectionId });
  if (error) throw error;
  return (data ?? []) as IdentityClientSecret[];
}

export async function deactivateIdentityClientSecret(id: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_identity_client_secret', { p_id: id });
  if (error) throw error;
}

export async function listIdentityRoleMappings(connectionId: string): Promise<IdentityRoleMapping[]> {
  const { data, error } = await supabase.from('identity_role_mappings').select('*').eq('connection_id', connectionId).order('priority', { ascending: true });
  if (error) throw error;
  return (data ?? []) as IdentityRoleMapping[];
}

export async function createIdentityRoleMapping(orgId: string, connectionId: string, input: { attributePath: string; matchValue: string; targetRole: IdentityRoleMapping['target_role']; priority: number }): Promise<IdentityRoleMapping> {
  const { data, error } = await supabase.from('identity_role_mappings').insert({
    org_id: orgId, connection_id: connectionId,
    attribute_path: input.attributePath, match_value: input.matchValue, target_role: input.targetRole, priority: input.priority,
  }).select().single();
  if (error) throw error;
  return data as IdentityRoleMapping;
}

export async function deleteIdentityRoleMapping(id: string): Promise<void> {
  const { error } = await supabase.from('identity_role_mappings').delete().eq('id', id);
  if (error) throw error;
}

/** INT-004 "prévisualisé avant activation" — evaluates the connection's
 *  mapping rules against an admin-supplied sample attributes payload,
 *  writes nothing. */
export async function previewSsoRoleMapping(connectionId: string, sampleAttributes: Record<string, unknown>): Promise<string[]> {
  const { data, error } = await supabase.rpc('preview_sso_role_mapping', { p_connection_id: connectionId, p_sample_attributes: sampleAttributes });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** Diagnostic feed (mirrors listLtiLaunches) — every login attempt, success
 *  or rejected, journaled by record_sso_login() inside sso-callback. */
export async function listSsoLogins(connectionId: string, limit = 20): Promise<SsoLogin[]> {
  const { data, error } = await supabase
    .from('sso_logins').select('*')
    .eq('connection_id', connectionId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SsoLogin[];
}

/** Completes INT-003 for a `sub` that landed on /sso/unlinked: writes the
 *  external_identities row sso-callback will look up on the next login
 *  attempt. Mirrors linkLtiSubject exactly. */
export async function linkSsoSubject(connectionId: string, subject: string, internalUserId: string): Promise<void> {
  const { error } = await supabase.rpc('link_sso_subject', {
    p_connection_id: connectionId, p_external_subject: subject, p_internal_user_id: internalUserId,
  });
  if (error) throw error;
}

/** The browser must navigate here directly (not fetch/invoke) — sso-login
 *  ends in a 302 redirect chain to the IdP and back. `redirectTo` is where
 *  the app lands once signed in (or, for a 'testing' connection, an
 *  Authorization header identifying the connection's own admin is required
 *  — see sso-login/index.ts — so this only works for the admin's own
 *  browser tab, not a link handed to anyone else). */
export function buildSsoLoginUrl(connectionId: string, redirectTo: string): string {
  const url = new URL(`${supabaseUrl}/functions/v1/sso-login`);
  url.searchParams.set('connection_id', connectionId);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

/** 'testing'-status connections can't use buildSsoLoginUrl's raw navigation
 *  (see sso-login/index.ts): a plain <a href> can't carry the admin's own
 *  Authorization header, which is how the connection's owner is verified.
 *  This goes through supabase.functions.invoke (attaches the caller's JWT
 *  automatically) and returns the IdP URL for the caller to navigate to
 *  itself — the response has already been consumed by invoke(), it can't be
 *  a 302 the browser follows on its own. */
/** Unauthenticated by design (RLS on identity_domains/identity_connections
 *  is admin-only — this is the one deliberately public read, scoped to only
 *  what a login button needs). Used by AuthPage.tsx to offer "Se connecter
 *  avec {provider}" once the typed email's domain matches an active
 *  connection (INT-002 `required_for_domains` mode). */
export async function resolveSsoConnectionForEmail(email: string): Promise<{ connection_id: string; display_name: string; protocol: 'oidc' | 'saml' } | null> {
  if (!email.includes('@')) return null;
  const { data, error } = await supabase.rpc('resolve_sso_connection_for_email', { p_email: email });
  if (error) throw error;
  return (data as { connection_id: string; display_name: string; protocol: 'oidc' | 'saml' }[])[0] ?? null;
}

export async function startSsoTestLogin(connectionId: string, redirectTo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('sso-login', {
    method: 'POST',
    body: { connection_id: connectionId, redirect_to: redirectTo },
  });
  if (error) throw error;
  return (data as { redirectUrl: string }).redirectUrl;
}

/** SAML SP-initiated login (production 'active' path) — mirrors buildSsoLoginUrl
 *  exactly; the browser must navigate here directly, saml-login ends in a
 *  redirect to the IdP and the IdP's own POST back to saml-acs. */
export function buildSamlLoginUrl(connectionId: string, redirectTo: string): string {
  const url = new URL(`${supabaseUrl}/functions/v1/saml-login`);
  url.searchParams.set('connection_id', connectionId);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

/** SAML equivalent of startSsoTestLogin — same 'testing'-status + connection-owner
 *  gating (see saml-login/index.ts), same invoke-then-navigate shape since a raw
 *  <a href> can't carry the admin's Authorization header either. */
export async function startSamlTestLogin(connectionId: string, redirectTo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('saml-login', {
    method: 'POST',
    body: { connection_id: connectionId, redirect_to: redirectTo },
  });
  if (error) throw error;
  return (data as { redirectUrl: string }).redirectUrl;
}

/** Static, connection-independent — one SP identity for the whole
 *  deployment (see saml-metadata/index.ts's header). Used by the admin UI
 *  to show what to paste into the IdP's own configuration. */
export function samlSpMetadataUrl(): string {
  return `${supabaseUrl}/functions/v1/saml-metadata`;
}
export function samlSpEntityId(): string {
  return `${window.location.origin}/sso/saml/metadata`;
}
export function samlSpAcsUrl(): string {
  return `${supabaseUrl}/functions/v1/saml-acs`;
}

export async function listLtiRegistrations(orgId: string): Promise<LtiRegistration[]> {
  const { data, error } = await supabase.from('lti_registrations').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LtiRegistration[];
}

export async function createLtiRegistration(input: { orgId: string; issuer: string; clientId: string; jwksUrl: string; authLoginUrl: string; authTokenUrl: string }): Promise<LtiRegistration> {
  const { data, error } = await supabase.from('lti_registrations').insert({
    org_id: input.orgId, issuer: input.issuer, client_id: input.clientId,
    jwks_url: input.jwksUrl, auth_login_url: input.authLoginUrl, auth_token_url: input.authTokenUrl,
  }).select().single();
  if (error) throw error;
  return data as LtiRegistration;
}

export async function listLtiDeployments(registrationId: string): Promise<LtiDeployment[]> {
  const { data, error } = await supabase.from('lti_deployments').select('*').eq('registration_id', registrationId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LtiDeployment[];
}

/** `deploymentId` must match the platform's own LTI deployment_id claim
 *  verbatim — lti-launch rejects any launch whose claim doesn't have a
 *  matching row (see supabase/functions/lti-launch/index.ts). */
export async function createLtiDeployment(registrationId: string, deploymentId: string, contextLabel: string): Promise<LtiDeployment> {
  const { data, error } = await supabase.from('lti_deployments').insert({
    registration_id: registrationId, deployment_id: deploymentId, context_label: contextLabel || null,
  }).select().single();
  if (error) throw error;
  return data as LtiDeployment;
}

/** Diagnostic feed (LTI-006) — every launch attempt, success or rejected,
 *  journaled by record_lti_launch(). Read-only (RLS: lti_launches_admin). */
export async function listLtiLaunches(registrationId: string, limit = 20): Promise<LtiLaunch[]> {
  const { data, error } = await supabase
    .from('lti_launches').select('*')
    .eq('registration_id', registrationId)
    .order('launched_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LtiLaunch[];
}

/** Completes LTI-005 for a `sub` that landed on /lti/unlinked: writes the
 *  external_mappings row lti-launch will look up on the platform's next
 *  attempt. Server-side (link_lti_subject RPC) validates the target user is
 *  actually a member of this org — external_mappings has no client insert
 *  policy at all, this RPC is the only write path. */
export async function linkLtiSubject(registrationId: string, subject: string, internalUserId: string): Promise<void> {
  const { error } = await supabase.rpc('link_lti_subject', {
    p_registration_id: registrationId, p_subject: subject, p_internal_user_id: internalUserId,
  });
  if (error) throw error;
}

export interface LtiConnectionTestResult {
  ok: boolean;
  reason?: string;
  keyCount?: number;
}

/** Live reachability/shape check of the registration's jwks_url — nothing
 *  persisted, a pre-activation sanity check (LTI-006 "test de connexion"). */
export async function testLtiConnection(registrationId: string): Promise<LtiConnectionTestResult> {
  const { data, error } = await supabase.functions.invoke('lti-test-connection', { body: { registrationId } });
  if (error) throw error;
  return data as LtiConnectionTestResult;
}

export async function listApiClients(orgId: string): Promise<ApiClient[]> {
  const { data, error } = await supabase.from('api_clients').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiClient[];
}

export async function createApiClient(orgId: string, name: string): Promise<ApiClient> {
  const clientId = `brivia_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const { data, error } = await supabase.from('api_clients').insert({ org_id: orgId, name, client_id: clientId }).select().single();
  if (error) throw error;
  return data as ApiClient;
}

export async function listWebhookEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabase.from('webhook_endpoints').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WebhookEndpoint[];
}

export async function createWebhookEndpoint(orgId: string, url: string, plaintextSecret: string): Promise<WebhookEndpoint> {
  // Hashing happens server-side; here we only pass a client-generated secret
  // the admin is shown once — see create_integration_secret() for the
  // connection-scoped equivalent used by OneRoster/SCIM.
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(plaintextSecret));
  const secretHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { data, error } = await supabase.from('webhook_endpoints').insert({ org_id: orgId, url, secret_hash: secretHash }).select().single();
  if (error) throw error;
  return data as WebhookEndpoint;
}
