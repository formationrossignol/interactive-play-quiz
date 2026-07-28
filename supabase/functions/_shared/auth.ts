import { createClient } from "npm:@supabase/supabase-js@2";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/** Resolves the calling user from the forwarded Authorization header, the
 *  same two-client pattern every host-authenticated function already used
 *  inline (anon-key client just to run auth.getUser(), separate service-role
 *  client for the actual privileged work) — extracted here since save-exam
 *  is the second caller of this exact shape (create-checkout-session was the
 *  first, see supabase/functions/create-checkout-session/index.ts). */
export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}
