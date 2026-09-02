// supabase/functions/video-info/index.ts
// POST /video-info
// Body: { url: string }
// Retorna: { success, videoInfo: { title, author, duration, thumbnail, ... } }
//
// Autenticação: REQUIRED (apenas usuários logados podem buscar)
// Estratégia: proxy para o Express local /api/video-info

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { isValidYoutubeUrl, extractVideoId, proxyToBackend } from '../_shared/youtube.ts';

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

    // 3. Proxy para o Express (que tem play-dl/ytdl-core)
    const backendRes = await proxyToBackend('/api/video-info', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url, userId, videoId }),
    });

    const data = await backendRes.json().catch(() => null);

    if (!backendRes.ok || !data) {
      console.error('Backend /video-info error:', backendRes.status, data);
      return errorResponse(
        data?.error ?? 'Erro ao buscar informações do vídeo no backend.',
        backendRes.status === 404 ? 404 : 502,
      );
    }

    return json({ success: true, videoInfo: data.videoInfo, videoId });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('video-info error:', e);
    return errorResponse('Erro interno ao processar a requisição.', 500);
  }
});
