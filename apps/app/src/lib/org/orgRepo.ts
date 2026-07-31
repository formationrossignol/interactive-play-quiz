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

export interface OrgMember {
  user_id: string;
  email: string;
  username: string | null;
  roles: OrgRole[];
  joined_at: string;
}

export interface OrgSettings {
  id: string;
  name: string;
  guest_access_enabled: boolean;
}

export interface AdminOrgSummary {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  guest_access_enabled: boolean;
  created_at: string;
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

/** Full member roster for an org — admin-only (enforced server-side). */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('list_org_members', { p_org_id: orgId });
  if (error) throw error;
  return data ?? [];
}

/** Adds a role to an existing member (cumulative — doesn't remove others). */
export async function grantOrgRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  const { error } = await supabase.rpc('admin_grant_org_role', { p_org_id: orgId, p_user_id: userId, p_role: role });
  if (error) throw error;
}

/** Throws 'last_admin' if this would leave the org without an admin. */
export async function revokeOrgRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_org_role', { p_org_id: orgId, p_user_id: userId, p_role: role });
  if (error) throw error;
}

/** Removes every role the user holds in the org. Throws 'last_admin' if they're the sole admin. */
export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_org_member', { p_org_id: orgId, p_user_id: userId });
  if (error) throw error;
}

/** Org id/name/guest-access — readable by any member (organizations_member_read). */
export async function fetchOrgSettings(orgId: string): Promise<OrgSettings> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, guest_access_enabled')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data;
}

/** Org admin/pedago only (enforced server-side). */
export async function updateGuestAccess(orgId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_org_guest_access', { p_org_id: orgId, p_enabled: enabled });
  if (error) throw error;
}

/** Site super-admin only (enforced server-side) — every org, read-only. */
export async function adminListAllOrgs(): Promise<AdminOrgSummary[]> {
  const { data, error } = await supabase.rpc('admin_list_all_orgs');
  if (error) throw error;
  return data ?? [];
}
