// frontend/src/environments/environment.ts
// Configuração para desenvolvimento local.
// Em produção, sobrescreva com environment.production.ts (ou use
// `ng build --configuration production` que troca automaticamente
// se fileReplacements estiver em angular.json).
export const environment = {
  production: false,

  supabase: {
    url:  'http://127.0.0.1:54321',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.local-dev-anon-key-replace-me',
  },

  // Backend local Express (até migrarmos tudo para Edge Functions)
  apiBaseUrl: 'http://localhost:3000',
};
