// supabase/functions/_shared/supabase-admin.ts
// Cria um cliente Supabase com privilégios elevados (service role).
// USE APENAS NO BACKEND (Edge Functions). NUNCA exponha a service role key
// ao frontend.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  }

  _admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:    false,
    },
  });
  return _admin;
}
