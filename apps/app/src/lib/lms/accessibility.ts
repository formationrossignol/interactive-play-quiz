import { supabase } from '@/lib/supabase';

export interface AccessibilityPreferences {
  user_id: string;
  font_size: 'default' | 'large' | 'x-large';
  spacing: 'default' | 'relaxed';
  high_contrast: boolean;
  reduce_motion: boolean;
  text_to_speech: boolean;
  preferred_language: string | null;
}

export interface AccommodationProfile {
  id: string;
  org_id: string;
  learner_id: string;
  status: 'active' | 'expired' | 'revoked';
  valid_from: string;
  valid_until: string | null;
}

export type AccommodationRuleType =
  | 'extra_time' | 'allowed_pause' | 'no_time_limit' | 'extended_deadline' | 'read_aloud'
  | 'voice_input' | 'text_size' | 'high_contrast' | 'reduced_motion' | 'preferred_language'
  | 'reduced_options' | 'extra_attempt' | 'hint' | 'alternative_modality' | 'separate_room';

export async function myAccessibilityPreferences(): Promise<AccessibilityPreferences | null> {
  const { data, error } = await supabase.from('accessibility_preferences').select('*').maybeSingle();
  if (error) throw error;
  return (data as AccessibilityPreferences | null) ?? null;
}

export async function upsertMyAccessibilityPreferences(userId: string, patch: Partial<AccessibilityPreferences>): Promise<AccessibilityPreferences> {
  const { data, error } = await supabase
    .from('accessibility_preferences')
    .upsert({ user_id: userId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as AccessibilityPreferences;
}

export async function listOrgAccommodationProfiles(orgId: string): Promise<AccommodationProfile[]> {
  const { data, error } = await supabase.from('accommodation_profiles').select('*').eq('org_id', orgId).order('valid_from', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccommodationProfile[];
}

export async function createAccommodationProfile(orgId: string, learnerId: string): Promise<AccommodationProfile> {
  const { data, error } = await supabase.from('accommodation_profiles').insert({ org_id: orgId, learner_id: learnerId }).select().single();
  if (error) throw error;
  return data as AccommodationProfile;
}

export async function setAccommodationRule(profileId: string, ruleType: AccommodationRuleType, value: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('accommodation_rules').upsert({ profile_id: profileId, rule_type: ruleType, value }, { onConflict: 'profile_id,rule_type' });
  if (error) throw error;
}

export interface EffectiveAccommodation {
  rule_type: AccommodationRuleType;
  value: Record<string, unknown>;
  source: 'profile' | 'override';
}

/** Audited read: merges activity-level overrides over the institutional profile (ACC-004). */
export async function getEffectiveAccommodations(learnerId: string, targetType?: string, targetId?: string): Promise<EffectiveAccommodation[]> {
  const { data, error } = await supabase.rpc('get_effective_accommodations', {
    p_learner_id: learnerId,
    p_target_type: targetType ?? null,
    p_target_id: targetId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as EffectiveAccommodation[];
}

// ── A11Y-007/009/010: content accessibility checker ─────────────────────

export interface ContentAccessibilityCheck {
  id: string;
  content_id: string;
  rule_code: string;
  severity: 'error' | 'warning';
  location: string;
  message: string;
  status: 'open' | 'fixed' | 'ignored';
  checked_at: string;
}

/** Re-runs the analyzer and returns every current finding (open, fixed,
 *  ignored) for this content — see check_content_accessibility() migration
 *  for the upsert/auto-resolve contract. */
export async function checkContentAccessibility(contentId: string): Promise<ContentAccessibilityCheck[]> {
  const { data, error } = await supabase.rpc('check_content_accessibility', { p_content_id: contentId });
  if (error) throw error;
  return (data ?? []) as ContentAccessibilityCheck[];
}

export async function listContentAccessibilityChecks(contentId: string): Promise<ContentAccessibilityCheck[]> {
  const { data, error } = await supabase.from('content_accessibility_checks').select('*').eq('content_id', contentId).order('severity').order('location');
  if (error) throw error;
  return (data ?? []) as ContentAccessibilityCheck[];
}

export async function setContentAccessibilityCheckStatus(checkId: string, status: 'open' | 'ignored'): Promise<ContentAccessibilityCheck> {
  const { data, error } = await supabase.rpc('set_content_accessibility_check_status', { p_check_id: checkId, p_status: status });
  if (error) throw error;
  return data as ContentAccessibilityCheck;
}

// ── A11Y: public accessibility declaration ───────────────────────────────

export interface AccessibilityAudit {
  id: string;
  org_id: string | null;
  scope: string;
  method: string;
  audited_on: string;
  status: 'conformant' | 'partially_conformant' | 'not_audited';
  report_url: string | null;
  published: boolean;
  created_at: string;
}

/** Direct RLS write (accessibility_audits_admin, org admin only) — no
 *  invariant beyond role/org to enforce, same posture as due_override. */
export async function listOrgAccessibilityAudits(orgId: string): Promise<AccessibilityAudit[]> {
  const { data, error } = await supabase.from('accessibility_audits').select('*').eq('org_id', orgId).order('audited_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccessibilityAudit[];
}

export async function createAccessibilityAudit(orgId: string, scope: string, method: string, status: AccessibilityAudit['status']): Promise<AccessibilityAudit> {
  const { data, error } = await supabase.from('accessibility_audits').insert({ org_id: orgId, scope, method, status }).select().single();
  if (error) throw error;
  return data as AccessibilityAudit;
}

export async function setAccessibilityAuditPublished(auditId: string, published: boolean): Promise<void> {
  const { error } = await supabase.from('accessibility_audits').update({ published }).eq('id', auditId);
  if (error) throw error;
}

/** accessibility_audits_public_read (published = true) has no org-role
 *  check — any authenticated platform user can read any org's published
 *  declaration, by design (it's meant to be public, see spec's "publier
 *  une déclaration factuelle"). */
export async function listPublishedAccessibilityAudits(): Promise<AccessibilityAudit[]> {
  const { data, error } = await supabase.from('accessibility_audits').select('*').eq('published', true).order('audited_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccessibilityAudit[];
}
