import { supabase } from '@/lib/supabase';

export interface IdentityConnection {
  id: string;
  org_id: string;
  protocol: 'oidc' | 'saml';
  display_name: string;
  status: 'draft' | 'testing' | 'active' | 'disabled';
  mode: 'optional' | 'required_for_domains' | 'admin_bypass';
  created_at: string;
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
