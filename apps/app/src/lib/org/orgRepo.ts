import { supabase } from '@/lib/supabase';

export type OrgRole = 'learner' | 'trainer' | 'pedago' | 'registrar' | 'admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
  organizations: Organization;
}

export interface OrgInvitation {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface InvitationPreview {
  org_name: string;
  role: OrgRole;
  email: string;
  status: string;
}

/** Pure: turn a display name into a URL/DB-safe slug candidate. No I/O. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** All orgs (with role) the current user belongs to. */
export async function myOrgMemberships(): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from('user_org_roles')
    .select('id, org_id, role, created_at, organizations(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OrgMembership[];
}

/** Atomic: creates the org and makes the caller its admin. */
export async function createOrganization(name: string, slug: string): Promise<Organization> {
  const { data, error } = await supabase.rpc('create_organization', { p_name: name, p_slug: slug });
  if (error) throw error;
  return data;
}

export async function listOrgInvitations(orgId: string): Promise<OrgInvitation[]> {
  const { data, error } = await supabase
    .from('org_invitations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOrgInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedBy: string,
): Promise<OrgInvitation> {
  const { data, error } = await supabase
    .from('org_invitations')
    .insert({ org_id: orgId, email, role, invited_by: invitedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function revokeOrgInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('org_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw error;
}

/** Fire-and-forget from the caller's side — mirrors register()'s welcome email. */
export async function sendOrgInvitationEmail(invitationId: string, inviteUrl: string): Promise<void> {
  await supabase.functions.invoke('send-org-invitation', { body: { invitationId, inviteUrl } });
}

/** Returns the org_id the caller was added to. Throws 'invitation_expired' / 'invitation_revoked' / 'invitation_accepted'. */
export async function acceptOrgInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_org_invitation', { p_token: token });
  if (error) throw error;
  return data;
}

/** Callable while logged out — the invite landing page's preview. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}
