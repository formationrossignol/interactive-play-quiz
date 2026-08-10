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
