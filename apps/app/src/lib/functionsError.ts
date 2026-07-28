/** Unwraps a supabase.functions.invoke() error into its HTTP status + parsed
 *  JSON body. error.message from the JS client is always a generic string
 *  ("Edge Function returned a non-2xx status code") — the actual status and
 *  error code/body only live in error.context (the raw Response). */
export interface EdgeFunctionErrorBody {
  error?: string;
  [key: string]: unknown;
}

export async function parseFunctionsError(
  error: unknown,
): Promise<{ status: number; body: EdgeFunctionErrorBody }> {
  const context = (error as { context?: Response }).context;
  if (!(context instanceof Response)) return { status: 0, body: { error: String(error) } };
  try {
    const body = await context.clone().json();
    return { status: context.status, body };
  } catch {
    return { status: context.status, body: { error: `HTTP ${context.status}` } };
  }
}
