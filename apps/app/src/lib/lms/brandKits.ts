import { supabase } from '@/lib/supabase';

/** Spec 10 CNT-019 (20260823040000_brand_kits.sql). No consumer wired: this
 *  codebase's builders don't read a brand kit to theme rendered content —
 *  that would need a themeable rendering surface that doesn't exist yet.
 *  The data model and CRUD are real; applying a kit to output is not. */
export interface BrandKitColor {
  name: string;
  hex: string;
}

export interface BrandKit {
  id: string;
  org_id: string;
  name: string;
  colors: BrandKitColor[];
  fonts: string[];
  logo_asset_id: string | null;
  component_rules: Record<string, unknown>;
  accessibility_rules: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function listBrandKits(orgId: string): Promise<BrandKit[]> {
  const { data, error } = await supabase.from('brand_kits').select('*').eq('org_id', orgId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrandKit[];
}

export async function createBrandKit(orgId: string, name: string): Promise<BrandKit> {
  const { data, error } = await supabase.from('brand_kits').insert({ org_id: orgId, name }).select().single();
  if (error) throw error;
  return data as BrandKit;
}

export async function updateBrandKit(
  id: string, patch: Partial<Pick<BrandKit, 'name' | 'colors' | 'fonts' | 'logo_asset_id' | 'component_rules' | 'accessibility_rules'>>,
): Promise<BrandKit> {
  const { data, error } = await supabase.from('brand_kits').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as BrandKit;
}

export async function deleteBrandKit(id: string): Promise<void> {
  const { error } = await supabase.from('brand_kits').delete().eq('id', id);
  if (error) throw error;
}

/** Atomic clear-old/set-new — a two-step client toggle would trip the
 *  partial unique index (org_id where is_default) on the instant between
 *  them, see the migration's comment on set_default_brand_kit(). */
export async function setDefaultBrandKit(id: string): Promise<void> {
  const { error } = await supabase.rpc('set_default_brand_kit', { p_kit_id: id });
  if (error) throw error;
}
