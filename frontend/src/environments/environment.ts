// frontend/src/environments/environment.ts
// Configuração para desenvolvimento local.
// Em produção, sobrescreva com environment.production.ts (ou use
// `ng build --configuration production` que troca automaticamente
// se fileReplacements estiver em angular.json).
export const environment = {
  production: false,

  supabase: {
    url:  'https://fgvcjxgwpwjohqumzziv.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndmNqeGd3cHdqb2hxdW16eml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgyMjAsImV4cCI6MjA4OTczNDIyMH0.vm5NOzlS2LMX-CDxes-v_vCeSktkDusZ00nEhdDkoxU',
  },
};
