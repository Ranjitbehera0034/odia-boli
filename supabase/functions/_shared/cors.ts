// Shared CORS headers for all Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Handle CORS preflight. Return this in every function handler.
 * Usage:
 *   if (req.method === 'OPTIONS') return handleCors();
 */
export function handleCors(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Validate cron authorization header.
 * Supabase pg_cron passes a shared secret in X-Cron-Key.
 */
export function verifyCronAuth(req: Request): boolean {
  const cronKey = req.headers.get('x-cron-key');
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return true; // No secret set — allow (dev mode)
  return cronKey === expected;
}

/**
 * JSON success response helper.
 */
export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * JSON error response helper.
 */
export function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
