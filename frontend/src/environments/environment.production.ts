// frontend/src/environments/environment.production.ts
// GERADO AUTOMATICAMENTE por scripts/write-env.cjs — NÃO EDITE MANUALMENTE.
export const environment = {
  production: true,

  supabase: {
    url: '__SUPABASE_URL__',
    anonKey: '__SUPABASE_ANON_KEY__',
  },

  apiBaseUrl: '', // vazio = usa Edge Functions via supabase.functions.invoke
};
