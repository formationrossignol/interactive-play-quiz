import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function fetchMyRole(): Promise<'user' | 'admin' | null> {
  const uid = getCurrentUser()?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (error) throw error;
  return (data?.role as 'user' | 'admin' | undefined) ?? null;
}

export function useIsAdmin() {
  const query = useQuery({ queryKey: ['admin', 'role'], queryFn: fetchMyRole });
  return { isAdmin: query.data === 'admin', isLoading: query.isLoading };
}
