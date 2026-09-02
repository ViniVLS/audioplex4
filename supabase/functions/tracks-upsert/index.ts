// supabase/functions/tracks-upsert/index.ts
// POST /tracks-upsert
// Body (snake_case): { video_id, title, author?, thumbnail?, duration?, formatted_duration?, source_url }
// Cria OU atualiza uma track do usuário (idempotente por user_id+video_id).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

interface UpsertBody {
  video_id?:           string;
  title?:              string;
  author?:             string;
  thumbnail?:          string;
  duration?:           number;
  formatted_duration?: string;
  source_url?:         string;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { userId, supabase } = await authenticate(req);

    let body: UpsertBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    if (!body.video_id || !body.title || !body.source_url) {
      return errorResponse('Campos obrigatórios: video_id, title, source_url.', 400);
    }

    const { data, error } = await supabase
      .from('tracks')
      .upsert(
        {
          user_id:            userId,
          video_id:           body.video_id,
          title:              body.title,
          author:             body.author            ?? null,
          thumbnail:          body.thumbnail         ?? null,
          duration:           body.duration          ?? null,
          formatted_duration: body.formatted_duration ?? null,
          source_url:         body.source_url,
        },
        { onConflict: 'user_id,video_id' },
      )
      .select()
      .single();

    if (error || !data) {
      console.error('tracks-upsert error:', error);
      return errorResponse(error?.message ?? 'Erro ao salvar track.', 500);
    }

    return json({ success: true, track: data });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('tracks-upsert fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});