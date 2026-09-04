// supabase/functions/_shared/cors.ts
// CORS headers padronizados para todas as Edge Functions.
export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
  'Access-Control-Max-Age':       '86400',
};
