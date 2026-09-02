// supabase/functions/extract-audio/index.ts
// POST /extract-audio
// Body: { url, trackId? }
// Retorna: { success, audioUrl, fileName, fileSizeBytes, container, codec, videoInfo }
//
// Fluxo:
//   1. Autentica
//   2. Resolve formato de áudio via @distube/ytdl-core (Opus 160k preferido)
//   3. Retorna a URL direta de download (ou stream de bytes) para o app baixar
//   4. Salva no histórico (download_history)
//
// Conversão para mp3/aac é feita NO DISPOSITIVO (FFmpegKit no Android).

import ytdl from 'npm:@distube/ytdl-core@4.16.4';
import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { isValidYoutubeUrl, extractVideoId, getVideoMetadata } from '../_shared/youtube.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Escolhe o melhor formato de áudio para download/conversão.
 * Prioriza Opus (webm) 160k — maior qualidade nativa.
 * Fallback: m4a (AAC) — compatível universalmente.
 */
function chooseBestDownloadFormat(info: ytdl.videoInfo): { url: string; container: string; codec: string; bitrate: number } {
  const formats = info.formats.filter((f) => f.hasAudio && !f.hasVideo && f.url);

  if (formats.length === 0) {
    throw new Error('Nenhum formato de áudio disponível para este vídeo.');
  }

  // 1. Opus 160k (melhor qualidade nativa para conversão)
  const opus = formats
    .filter((f) => f.container === 'webm')
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (opus.length > 0 && opus[0].url) {
    return {
      url: opus[0].url,
      container: 'webm',
      codec: opus[0].audioCodec ?? 'opus',
      bitrate: (opus[0].audioBitrate ?? 160) * 1000,
    };
  }

  // 2. m4a (AAC) — compatível com tudo
  const m4a = formats
    .filter((f) => f.container === 'm4a')
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (m4a.length > 0 && m4a[0].url) {
    return {
      url: m4a[0].url,
      container: 'm4a',
      codec: m4a[0].audioCodec ?? 'mp4a.40.2',
      bitrate: (m4a[0].audioBitrate ?? 128) * 1000,
    };
  }

  // 3. Fallback: qualquer áudio
  const best = formats.sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0))[0];
  return {
    url: best.url!,
    container: best.container,
    codec: best.audioCodec ?? 'unknown',
    bitrate: (best.audioBitrate ?? 128) * 1000,
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { userId } = await authenticate(req);

    let body: { url?: string; trackId?: string };
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

    // 1. Busca info + escolhe melhor formato
    const videoInfo = await getVideoMetadata(body.url!);
    const ytInfo = await ytdl.getInfo(body.url!);
    const format = chooseBestDownloadFormat(ytInfo);

    // 2. Download dos bytes de áudio
    const upstreamRes = await fetch(format.url);

    if (!upstreamRes.ok) {
      return errorResponse(`Erro ao baixar áudio: status ${upstreamRes.status}`, 502);
    }

    // 3. Monta nome do arquivo
    const safeTitle = `${videoInfo.author} - ${videoInfo.title}`
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .substring(0, 120);

    const ext = format.container === 'webm' ? 'webm' : 'm4a';
    const fileName = `${safeTitle}.${ext}`;

    const contentLength = upstreamRes.headers.get('Content-Length');
    const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : null;

    // 4. Salva no histórico
    const admin = getSupabaseAdmin();
    const { error: historyErr } = await admin
      .from('download_history')
      .insert({
        user_id:         userId,
        track_id:        body.trackId ?? null,
        quality:         `${Math.round(format.bitrate / 1000)}k`,
        format:          format.container,
        file_size_bytes: fileSizeBytes,
      });

    if (historyErr) {
      console.error('Falha ao salvar download_history:', historyErr);
    }

    // 5. Retorna os bytes de áudio diretamente como download
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', format.container === 'webm' ? 'audio/webm' : 'audio/mp4');
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    if (contentLength) headers.set('Content-Length', contentLength);

    // Retorna metadata no header X-Audio-Info (para o app saber o que baixou)
    headers.set('X-Audio-Info', JSON.stringify({
      container: format.container,
      codec:     format.codec,
      bitrate:   format.bitrate,
      fileName,
      videoInfo,
    }));

    return new Response(upstreamRes.body, {
      status: 200,
      headers,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('extract-audio error:', e);
    return errorResponse('Erro interno ao processar extração.', 500);
  }
});
