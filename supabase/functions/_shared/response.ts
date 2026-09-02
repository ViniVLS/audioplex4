// supabase/functions/_shared/response.ts
// Helpers para padronizar respostas JSON e tratamento de erros.
import { corsHeaders } from './cors.ts';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, extra?: object): Response {
  return json({ success: false, error: message, ...extra }, status);
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
