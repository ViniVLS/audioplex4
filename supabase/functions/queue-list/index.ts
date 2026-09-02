// supabase/functions/queue-list/index.ts
// GET /queue-list
// Retorna a fila do usuário ordenada por position (asc).

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

    // JOIN tracks + queue_items
    const { data, error } = await supabase
      .from('queue_items')
      .select(`
        id,
        position,
        added_at,
        track:tracks (
          id, video_id, title, author, thumbnail,
          duration, formatted_duration, source_url,
          format, bitrate, file_size_bytes,
          created_at, updated_at
        )
      `)
      .order('position', { ascending: true });

    if (error) {
      console.error('queue-list error:', error);
      return errorResponse('Erro ao listar fila.', 500);
    }

    return json({ success: true, queue: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('queue-list fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
