// Edge Functions are called directly from the browser (supabase.functions.invoke),
// which triggers a CORS preflight. Every function must handle OPTIONS and echo
// these headers on every response, or the browser blocks the call before it
// ever reaches the function body.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
