// supabase/functions/queue-add/index.ts
// POST /queue-add
// Body (snake_case, igual ao modelo Track e ao que o banco retorna):
//   { video_id, title, author?, thumbnail?, duration?, formatted_duration?, source_url }
// Cria a track (se não existir) e adiciona à fila no final.
// Idempotente: adicionar o mesmo track 2x é no-op (unique constraint).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

interface AddBody {
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

    let body: AddBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    if (!body.video_id || !body.title || !body.source_url) {
      return errorResponse('Campos obrigatórios: video_id, title, source_url.', 400);
    }

    // 1. Upsert da track
    const { data: track, error: trackErr } = await supabase
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

    if (trackErr || !track) {
      console.error('queue-add upsert error:', trackErr);
      return errorResponse(trackErr?.message ?? 'Erro ao salvar track.', 500);
    }

    // 2. Verifica se já está na fila
    const { data: existing } = await supabase
      .from('queue_items')
      .select('id, position')
      .eq('track_id', track.id)
      .maybeSingle();

    if (existing) {
      return json({
        success: true,
        alreadyInQueue: true,
        track,
        queueItem: existing,
      });
    }

    // 3. Calcula próxima posição via RPC helper
    const { data: nextPos, error: posErr } = await supabase
      .rpc('next_queue_position', { p_user_id: userId });

    if (posErr) {
      console.error('queue-add next_pos error:', posErr);
      return errorResponse('Erro ao calcular posição.', 500);
    }

    // 4. Insere
    const { data: queueItem, error: insertErr } = await supabase
      .from('queue_items')
      .insert({
        user_id:  userId,
        track_id: track.id,
        position: nextPos ?? 0,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('queue-add insert error:', insertErr);
      return errorResponse(insertErr.message, 500);
    }

    return json({ success: true, track, queueItem });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('queue-add fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});