// supabase/functions/auth-session/index.ts
// GET /auth-session
// Valida o JWT do usuário e retorna dados do perfil + prefs atuais.
// Endpoint público-privado: requer Authorization header, mas é o ponto
// de entrada que o frontend usa para verificar se a sessão é válida
// logo após o login.

import { authenticate } from '../_shared/auth.ts';
import { corsHeaders }   from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { userId, user, supabase } = await authenticate(req);

    // Busca perfil + preferências em paralelo
    const [{ data: profile }, { data: prefs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('player_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    // Garante que prefs existam (criadas via trigger, mas fallback defensivo)
    if (!prefs) {
      const admin = getSupabaseAdmin();
      const { data: created } = await admin
        .from('player_preferences')
        .insert({ user_id: userId })
        .select()
        .single();
      return json({
        success: true,
        user: {
          id:    user.id,
          email: user.email,
          provider: user.app_metadata?.provider ?? 'email',
          created_at: user.created_at,
        },
        profile: profile ?? null,
        preferences: created ?? null,
      });
    }

    return json({
      success: true,
      user: {
        id:    user.id,
        email: user.email,
        provider: user.app_metadata?.provider ?? 'email',
        created_at: user.created_at,
      },
      profile: profile ?? null,
      preferences: prefs,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('auth-session error:', e);
    return errorResponse('Erro interno ao validar sessão.', 500);
  }
});
