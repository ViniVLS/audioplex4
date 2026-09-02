// supabase/functions/video-info/index.ts
// POST /video-info
// Body: { url: string }
// Retorna: { success, videoInfo: { title, author, duration, thumbnail, ... }, videoId }
//
// Autenticação: REQUIRED
// Versão 100% Deno — usa @distube/ytdl-core direto (sem Express).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { isValidYoutubeUrl, extractVideoId, getVideoMetadata } from '../_shared/youtube.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    // 1. Autentica
    const { userId } = await authenticate(req);

    // 2. Valida body
    let body: { url?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    const url = body?.url;
    if (!isValidYoutubeUrl(url)) {
      return errorResponse('URL do YouTube inválida ou não informada.', 400);
    }

    const videoId = extractVideoId(url!);
    if (!videoId) {
      return errorResponse('Não foi possível extrair o video_id da URL.', 400);
    }

    // 3. Busca metadata via ytdl-core (Deno, sem Express)
    const videoInfo = await getVideoMetadata(url!);

    return json({ success: true, videoInfo, videoId });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('video-info error:', e);
    return errorResponse('Erro interno ao buscar informações do vídeo.', 500);
  }
});
