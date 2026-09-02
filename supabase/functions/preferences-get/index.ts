// supabase/functions/preferences-get/index.ts
// GET /preferences-get
// Retorna as preferências de player do usuário autenticado.

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { supabase, userId } = await authenticate(req);

    const { data, error } = await supabase
      .from('player_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('preferences-get error:', error);
      return errorResponse('Erro ao buscar preferências.', 500);
    }

    if (data) {
      return json({ success: true, preferences: data });
    }

    // Fallback: cria prefs padrão (caso trigger tenha falhado)
    const admin = getSupabaseAdmin();
    const { data: created, error: createErr } = await admin
      .from('player_preferences')
      .insert({ user_id: userId })
      .select()
      .single();

    if (createErr) {
      console.error('preferences-get create fallback error:', createErr);
      return errorResponse('Erro ao criar preferências padrão.', 500);
    }

    return json({ success: true, preferences: created });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('preferences-get fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
