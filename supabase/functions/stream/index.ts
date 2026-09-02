// supabase/functions/stream/index.ts
// GET /stream?videoId=XXX
// Faz proxy de stream de áudio do YouTube com suporte a Range requests
// (necessário para <audio> fazer seeking).
//
// Autenticação: REQUIRED
// Cache: URLs de stream do YouTube expiram em ~6h. Fazemos cache
// in-memory com TTL de 5min para evitar bater no YouTube em cada seek.

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, errorResponse } from '../_shared/response.ts';
import { proxyToBackend } from '../_shared/youtube.ts';
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
  // Limpa entradas expiradas periodicamente
  if (cache.size > 100) {
    for (const [k, v] of cache) {
      if (Date.now() > v.expiresAt) cache.delete(k);
    }
  }
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

    // Resolve a URL de stream (cache primeiro)
    let streamUrl = getCachedStreamUrl(videoId);

    if (!streamUrl) {
      const resolveRes = await proxyToBackend(`/api/stream/resolve?videoId=${videoId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!resolveRes.ok) {
        const err = await resolveRes.json().catch(() => null);
        return errorResponse(err?.error ?? 'Falha ao resolver stream.', resolveRes.status);
      }

      const data = await resolveRes.json();
      streamUrl = data.streamUrl;
      if (!streamUrl) return errorResponse('streamUrl ausente na resposta.', 502);

      setCachedStreamUrl(videoId, streamUrl);
    }

    // Faz proxy do stream real com suporte a Range
    const rangeHeader = req.headers.get('Range');
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    const upstream = await fetch(streamUrl, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      // Invalida cache em caso de erro (URL pode ter expirado)
      cache.delete(videoId);
      return errorResponse(`Upstream retornou ${upstream.status}.`, 502);
    }

    // Repassa o body com headers apropriados
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'audio/webm');
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
