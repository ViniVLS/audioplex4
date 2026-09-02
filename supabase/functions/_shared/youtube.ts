// supabase/functions/_shared/youtube.ts
// Helpers para validação de URL do YouTube e proxy para o backend
// Express local (até migrarmos a lógica pesada de ffmpeg para Deno).
//
// Em produção: configure BACKEND_INTERNAL_URL como secret.
// Em dev local: default http://host.docker.internal:3000 (o Express
// roda na máquina host, container do Supabase CLI alcança via DNS).

export function isValidYoutubeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

export function extractVideoId(url: string): string | null {
  if (!url) return null;

  // youtu.be/VIDEO_ID
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];

  // youtube.com/watch?v=VIDEO_ID
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watch) return watch[1];

  // youtube.com/shorts/VIDEO_ID
  const shorts = url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  if (shorts) return shorts[1];

  // youtube.com/embed/VIDEO_ID
  const embed = url.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];

  return null;
}

export function getBackendUrl(): string {
  return Deno.env.get('BACKEND_INTERNAL_URL') ?? 'http://host.docker.internal:3000';
}

/**
 * Faz proxy de uma chamada HTTP para o backend Express.
 * Lança erro se a resposta não for 2xx.
 */
export async function proxyToBackend(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 55_000, ...fetchInit } = init; // Edge Functions têm timeout de 60s
  const url = `${getBackendUrl()}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}
