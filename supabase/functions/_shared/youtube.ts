// supabase/functions/_shared/youtube.ts
// Helpers para YouTube: validação, metadata e stream.
// Versão 100% Deno — sem dependência do Express.

import ytdl from 'npm:@distube/ytdl-core@4.16.4';

// ── URL helpers ─────────────────────────────────────────────

export function isValidYoutubeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

export function extractVideoId(url: string): string | null {
  if (!url) return null;

  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];

  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watch) return watch[1];

  const shorts = url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  if (shorts) return shorts[1];

  const embed = url.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];

  return null;
}

// ── ytdl-core wrappers ─────────────────────────────────────

/** Opções de formato para áudio. */
export interface AudioFormat {
  itag: number;
  container: string;     // m4a, webm, mp4
  codec: string;         // opus, mp4a.40.2, etc.
  bitrate: number;       // em bps
}

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  authorUrl: string;
  durationSeconds: number;
  formattedDuration: string;
  thumbnail: string;
  viewCount: number;
  formattedViews: string;
  uploadDate: string;
  description: string;
  url: string;
}

/**
 * Normaliza e limpa a URL do YouTube.
 */
function cleanUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.includes('youtube.com/shorts/')) {
    const shortId = cleaned.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('&')[0];
    if (shortId) cleaned = `https://www.youtube.com/watch?v=${shortId}`;
  }
  if (cleaned.includes('music.youtube.com')) {
    cleaned = cleaned.replace('music.youtube.com', 'www.youtube.com');
  }
  return cleaned;
}

/**
 * Formata segundos em "mm:ss" ou "h:mm:ss".
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (!views) return '0';
  if (views >= 1_000_000_000) return (views / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (views >= 1_000) return (views / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return views.toString();
}

/**
 * Busca metadata completa do vídeo.
 */
export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const cleaned = cleanUrl(url);
  const info = await ytdl.getInfo(cleaned);

  const details = info.videoDetails;
  const lengthSec = parseInt(details.lengthSeconds, 10);

  let thumbnail = details.thumbnail?.thumbnails?.at(-1)?.url ?? '';
  if (!thumbnail && details.thumbnails?.length) {
    thumbnail = details.thumbnails[details.thumbnails.length - 1].url;
  }

  return {
    id: details.videoId,
    title: details.title ?? 'Áudio do YouTube',
    author: details.author?.name ?? 'Desconhecido',
    authorUrl: details.author?.channel_url ?? '',
    durationSeconds: lengthSec,
    formattedDuration: formatDuration(lengthSec),
    thumbnail,
    viewCount: parseInt(details.viewCount ?? '0', 10),
    formattedViews: formatViews(parseInt(details.viewCount ?? '0', 10)),
    uploadDate: '',
    description: (details.shortDescription ?? '').substring(0, 250),
    url: details.video_url ?? cleaned,
  };
}

/**
 * Retorna a URL de stream de melhor qualidade para áudio.
 * Prioriza m4a (AAC) para compatibilidade universal.
 * Fallback: webm (Opus) para streaming em browsers.
 */
export function getBestAudioUrl(info: ytdl.videoInfo, preferContainer: 'm4a' | 'webm' | 'opus' = 'm4a'): string {
  const formats = info.formats.filter((f) => f.hasAudio && !f.hasVideo);

  if (formats.length === 0) {
    throw new Error('Nenhum formato de áudio disponível para este vídeo.');
  }

  // Tenta escolher o formato preferido (m4a primeiro para compatibilidade)
  const preferred = formats.find((f) => f.container === preferContainer && f.isHLS);
  if (preferred?.url) return preferred.url;

  // Qualquer m4a
  const m4a = formats.find((f) => f.container === 'm4a');
  if (m4a?.url) return m4a.url;

  // Qualquer MP4/AAC
  const mp4 = formats.find((f) => f.container === 'mp4');
  if (mp4?.url) return mp4.url;

  // Fallback: melhor bitrate disponível
  const sorted = formats
    .filter((f) => f.url)
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (sorted.length > 0 && sorted[0].url) return sorted[0].url;

  throw new Error('Não foi possível obter URL de stream de áudio.');
}

/**
 * Retorna a URL de stream de MAIOR qualidade de áudio (para download/conversão).
 * Prioriza Opus (webm) 160k — maior qualidade nativa do YouTube.
 * Se Opus não disponível, fallback para m4a (AAC).
 */
export function getHighestQualityAudioUrl(info: ytdl.videoInfo): string {
  const formats = info.formats.filter((f) => f.hasAudio && !f.hasVideo);

  if (formats.length === 0) {
    throw new Error('Nenhum formato de áudio disponível para este vídeo.');
  }

  // Tenta Opus 160k primeiro (melhor qualidade nativa)
  const opus = formats
    .filter((f) => f.container === 'webm' && f.url)
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (opus.length > 0 && opus[0].url) return opus[0].url;

  // Fallback: melhor bitrate disponível (m4a AAC)
  const sorted = formats
    .filter((f) => f.url)
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (sorted.length > 0 && sorted[0].url) return sorted[0].url;

  throw new Error('Não foi possível obter URL de stream de áudio de alta qualidade.');
}

/**
 * Retorna informações detalhadas dos formatos de áudio disponíveis.
 */
export function getAudioFormats(info: ytdl.videoInfo): AudioFormat[] {
  return info.formats
    .filter((f) => f.hasAudio && !f.hasVideo && f.url)
    .map((f) => ({
      itag: f.itag as number,
      container: f.container,
      codec: f.audioCodec ?? 'unknown',
      bitrate: (f.audioBitrate ?? 0) * 1000,
    }))
    .sort((a, b) => b.bitrate - a.bitrate);
}
