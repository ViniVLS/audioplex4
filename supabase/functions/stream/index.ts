// supabase/functions/stream/index.ts
// GET /stream?videoId=XXX
// Faz proxy de stream de áudio do YouTube com suporte a Range requests.
//
// Versão 100% Deno — resolve a URL via @distube/ytdl-core e proxy direto.
// Cache in-memory de URLs (TTL 5min) para não bater no YouTube a cada seek.

import ytdl from 'npm:@distube/ytdl-core@4.16.4';
import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, errorResponse } from '../_shared/response.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface CacheEntry {
  url: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedStreamUrl(videoId: string): string | null {
  const entry = cache.get(videoId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(videoId);
    return null;
  }
  return entry.url;
}

function setCachedStreamUrl(videoId: string, url: string): void {
  cache.set(videoId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 200) {
    for (const [k, v] of cache) {
      if (Date.now() > v.expiresAt) cache.delete(k);
    }
  }
}

async function resolveStreamUrl(videoId: string): Promise<string> {
  const cached = getCachedStreamUrl(videoId);
  if (cached) return cached;

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await ytdl.getInfo(url);

  // Melhor áudio: m4a (AAC) para compatibilidade
  const formats = info.formats.filter((f) => f.hasAudio && !f.hasVideo);
  if (formats.length === 0) throw new Error('Nenhum formato de áudio encontrado.');

  // Prioriza m4a (compatível com todos os players)
  const sorted = formats
    .filter((f) => f.url)
    .sort((a, b) => {
      // m4a primeiro, depois por bitrate
      const aM4a = a.container === 'm4a' ? 1 : 0;
      const bM4a = b.container === 'm4a' ? 1 : 0;
      if (bM4a !== aM4a) return bM4a - aM4a;
      return (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0);
    });

  if (sorted.length === 0 || !sorted[0].url) {
    throw new Error('Não foi possível obter URL de stream.');
  }

  const streamUrl = sorted[0].url;
  setCachedStreamUrl(videoId, streamUrl);
  return streamUrl;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    await authenticate(req);

    const url = new URL(req.url);
    const videoId = url.searchParams.get('videoId');
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return errorResponse('videoId inválido.', 400);
    }

    const streamUrl = await resolveStreamUrl(videoId);

    // Proxy com suporte a Range
    const rangeHeader = req.headers.get('Range');
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    const upstream = await fetch(streamUrl, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      cache.delete(videoId);
      return errorResponse(`Upstream retornou ${upstream.status}.`, 502);
    }

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'audio/mp4');
    headers.set('Accept-Ranges', 'bytes');

    const contentRange = upstream.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);

    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('stream error:', e);
    return errorResponse('Erro interno no proxy de stream.', 500);
  }
});
