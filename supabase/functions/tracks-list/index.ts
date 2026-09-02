// supabase/functions/tracks-list/index.ts
// GET /tracks-list?limit=50&offset=0
// Retorna as tracks do usuário autenticado, ordenadas por created_at desc.

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { supabase } = await authenticate(req);

    const url = new URL(req.url);
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50', 10) || 50, 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0',  10) || 0, 0);

    const { data, error, count } = await supabase
      .from('tracks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('tracks-list error:', error);
      return errorResponse('Erro ao listar tracks.', 500);
    }

    return json({
      success: true,
      tracks:  data ?? [],
      total:   count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('tracks-list fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
