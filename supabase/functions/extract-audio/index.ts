// supabase/functions/extract-audio/index.ts
// POST /extract-audio
// Body: { url, quality, format, trackId? }
// Fluxo:
//   1. Autentica
//   2. Valida input
//   3. Chama backend Express /api/extract-audio (que faz o ffmpeg)
//   4. Salva no histórico (download_history) com user_id
//   5. Retorna downloadUrl (signed/temporário ou caminho no disco)
//
// IMPORTANTE: como o áudio NÃO vai para Storage, geramos um link de
// download efêmero servido pelo próprio Express (já existe lógica de
// auto-delete em 5min no audioController).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { isValidYoutubeUrl, extractVideoId, proxyToBackend } from '../_shared/youtube.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { userId } = await authenticate(req);

    let body: {
      url?:     string;
      quality?: 'high' | 'medium' | 'low' | '320k' | '256k' | '128k';
      format?:  'mp3' | 'aac' | 'wav' | 'flac';
      trackId?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    if (!isValidYoutubeUrl(body.url)) {
      return errorResponse('URL do YouTube inválida.', 400);
    }

    const videoId = extractVideoId(body.url!);
    if (!videoId) {
      return errorResponse('Não foi possível extrair o video_id.', 400);
    }

    // 1. Chama o Express para fazer a extração/conversão
    const backendRes = await proxyToBackend('/api/extract-audio', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        url:     body.url,
        quality: body.quality ?? 'high',
        format:  body.format  ?? 'mp3',
        userId,
        videoId,
      }),
      timeoutMs: 55_000, // próximo do limite da Edge Function
    });

    const data = await backendRes.json().catch(() => null);

    if (!backendRes.ok || !data?.success) {
      console.error('Backend /extract-audio error:', backendRes.status, data);
      return errorResponse(
        data?.error ?? 'Erro ao extrair o áudio no backend.',
        backendRes.status === 404 ? 404 : 502,
      );
    }

    // 2. Salva no histórico do usuário (RLS garante isolamento)
    const admin = getSupabaseAdmin();
    const { error: historyErr } = await admin
      .from('download_history')
      .insert({
        user_id:         userId,
        track_id:        body.trackId ?? null,
        quality:         body.quality ?? 'high',
        format:          body.format  ?? 'mp3',
        file_size_bytes: data.fileSizeBytes ?? null,
      });

    if (historyErr) {
      console.error('Falha ao salvar download_history:', historyErr);
      // Não falhamos a requisição por causa disso, apenas logamos.
    }

    return json({
      success:      true,
      fileName:     data.fileName,
      downloadUrl:  data.downloadUrl,
      fileSize:     data.fileSize,
      bitrate:      data.bitrate,
      format:       data.format,
      formatLabel:  data.formatLabel,
      videoInfo:    data.videoInfo,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('extract-audio error:', e);
    return errorResponse('Erro interno ao processar extração.', 500);
  }
});
