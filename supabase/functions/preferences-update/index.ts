// supabase/functions/preferences-update/index.ts
// PATCH /preferences-update
// Body: { volume?, muted?, repeatMode?, shuffle?, currentTrackId?, currentPositionSeconds? }
// Atualiza as preferências do player (PUT semântico com PATCH).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

interface UpdateBody {
  volume?:                   number;
  muted?:                    boolean;
  repeatMode?:               'off' | 'one' | 'all';
  shuffle?:                  boolean;
  currentTrackId?:           string | null;
  currentPositionSeconds?:   number;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { supabase, userId } = await authenticate(req);

    let body: UpdateBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    // Validações
    if (body.volume !== undefined) {
      if (typeof body.volume !== 'number' || body.volume < 0 || body.volume > 1) {
        return errorResponse('volume deve estar entre 0 e 1.', 400);
      }
    }
    if (body.repeatMode !== undefined && !['off', 'one', 'all'].includes(body.repeatMode)) {
      return errorResponse('repeatMode inválido.', 400);
    }
    if (body.muted     !== undefined && typeof body.muted     !== 'boolean') {
      return errorResponse('muted deve ser boolean.', 400);
    }
    if (body.shuffle   !== undefined && typeof body.shuffle   !== 'boolean') {
      return errorResponse('shuffle deve ser boolean.', 400);
    }

    // Mapeia camelCase → snake_case do DB
    const dbPayload: Record<string, unknown> = {};
    if (body.volume                 !== undefined) dbPayload.volume                    = body.volume;
    if (body.muted                  !== undefined) dbPayload.muted                     = body.muted;
    if (body.repeatMode             !== undefined) dbPayload.repeat_mode               = body.repeatMode;
    if (body.shuffle                !== undefined) dbPayload.shuffle                   = body.shuffle;
    if (body.currentTrackId         !== undefined) dbPayload.current_track_id          = body.currentTrackId;
    if (body.currentPositionSeconds !== undefined) dbPayload.current_position_seconds  = body.currentPositionSeconds;

    if (Object.keys(dbPayload).length === 0) {
      return errorResponse('Nenhum campo para atualizar.', 400);
    }

    const { data, error } = await supabase
      .from('player_preferences')
      .update(dbPayload)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('preferences-update error:', error);
      return errorResponse(error?.message ?? 'Erro ao atualizar.', 500);
    }

    return json({ success: true, preferences: data });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('preferences-update fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
