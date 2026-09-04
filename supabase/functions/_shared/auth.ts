// supabase/functions/_shared/auth.ts
// Middleware-like helper: valida o JWT do header Authorization e
// retorna o user_id. Lança Response 401 se inválido.
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from './cors.ts';

export interface AuthContext {
  user: User;
  userId: string;
  supabase: SupabaseClient; // cliente com o JWT do usuário (respeita RLS)
}

export async function authenticate(req: Request): Promise<AuthContext> {
  // Suporta o token via header Authorization OU query param ?token=.
  // O ?token= é necessário para players que não enviam headers customizados
  // (ex.: <audio> HTML e ExoPlayer nativo no Android).
  let jwt = req.headers.get('Authorization');
  if (jwt && jwt.startsWith('Bearer ')) {
    jwt = jwt.replace('Bearer ', '');
  } else {
    jwt = null;
  }

  if (!jwt) {
    const url = new URL(req.url);
    jwt = url.searchParams.get('token');
  }

  if (!jwt) {
    throw new Response(
      JSON.stringify({ success: false, error: 'Token de autenticação ausente.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Cliente Supabase com o JWT do usuário (RLS respeitado)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data?.user) {
    throw new Response(
      JSON.stringify({ success: false, error: 'Token inválido ou expirado.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return { user: data.user, userId: data.user.id, supabase };
}
