const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { cleanYoutubeUrl, isValidYoutubeUrl } = require('../utils/youtube');

const YTDLP_PATH = path.join(__dirname, '../../bin/yt-dlp.exe');

/**
 * GET /api/stream/resolve?videoId=XXX
 * Retorna a URL direta de stream de áudio (m4a/webm) para o videoId.
 * Usado pela Edge Function `stream` (que faz proxy com Range support).
 *
 * Cache em memória: URLs do YouTube expiram em ~6h; cacheamos por 5min.
 */
const resolveCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveStream(req, res) {
  try {
    const { videoId } = req.query;

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        success: false,
        error: 'videoId inválido (esperado 11 caracteres alfanuméricos).',
      });
    }

    // 1. Cache hit
    const cached = resolveCache.get(videoId);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json({ success: true, streamUrl: cached.url, cached: true });
    }

    // 2. yt-dlp -g retorna a URL direta
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (!isValidYoutubeUrl(url)) {
      return res.status(400).json({ success: false, error: 'URL inválida.' });
    }

    const cleanedUrl = cleanYoutubeUrl(url);

    const stdout = await new Promise((resolve, reject) => {
      const args = [
        '-g',
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
        '--no-warnings',
        '--no-playlist',
        cleanedUrl,
      ];
      const proc = spawn(YTDLP_PATH, args);
      let out = '';
      let err = '';

      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { err += d.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && out.trim()) resolve(out.trim());
        else reject(new Error(err || `yt-dlp exited with code ${code}`));
      });
      proc.on('error', reject);

      // Timeout de 10s
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (_) { /* ignore */ }
        reject(new Error('Timeout ao resolver stream.'));
      }, 10_000);
    });

    // yt-dlp pode retornar múltiplas URLs (uma por linha); pegamos a primeira
    const streamUrl = stdout.split('\n')[0].trim();

    if (!streamUrl.startsWith('http')) {
      return res.status(502).json({
        success: false,
        error: 'yt-dlp não retornou uma URL válida.',
      });
    }

    // 3. Cache
    resolveCache.set(videoId, {
      url: streamUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Limpeza periódica
    if (resolveCache.size > 200) {
      for (const [k, v] of resolveCache) {
        if (Date.now() > v.expiresAt) resolveCache.delete(k);
      }
    }

    return res.json({ success: true, streamUrl, cached: false });
  } catch (error) {
    console.error('stream/resolve error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao resolver stream.',
    });
  }
}

module.exports = { resolveStream, streamAudio };

/**
 * GET /api/stream?videoId=XXX
 * Proxy de stream de áudio com suporte a Range requests.
 * Resolve a URL direta (cache) e faz forward do body para o <audio>.
 */
async function streamAudio(req, res) {
  try {
    const { videoId } = req.query;

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        success: false,
        error: 'videoId inválido (esperado 11 caracteres alfanuméricos).',
      });
    }

    // 1. Resolve a URL direta (usando o mesmo cache do resolveStream)
    let streamUrl = getCachedStreamUrl(videoId);
    if (!streamUrl) {
      streamUrl = await resolveDirectStreamUrl(videoId);
      setCachedStreamUrl(videoId, streamUrl);
    }

    // 2. Faz proxy com suporte a Range
    const rangeHeader = req.headers.range;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };
    if (rangeHeader) headers['Range'] = rangeHeader;

    const pipe = (client) => {
      const lib = client.startsWith('https') ? https : http;
      const upstream = lib.get(client, { headers }, (upstreamRes) => {
        const status = upstreamRes.statusCode;

        res.status(status >= 200 && status < 400 ? status : 502);

        if (upstreamRes.headers['content-type']) {
          res.setHeader('Content-Type', upstreamRes.headers['content-type']);
        } else {
          res.setHeader('Content-Type', 'audio/webm');
        }
        res.setHeader('Accept-Ranges', 'bytes');

        if (upstreamRes.headers['content-range']) {
          res.setHeader('Content-Range', upstreamRes.headers['content-range']);
        }
        if (upstreamRes.headers['content-length']) {
          res.setHeader('Content-Length', upstreamRes.headers['content-length']);
        }
        if (upstreamRes.headers['content-disposition']) {
          res.setHeader('Content-Disposition', upstreamRes.headers['content-disposition']);
        }

        upstreamRes.pipe(res);

        upstreamRes.on('error', (err) => {
          console.error('stream proxy upstream error:', err.message);
          if (!res.headersSent) res.status(502).end();
        });
      });

      upstream.on('error', (err) => {
        console.error('stream proxy request error:', err.message);
        if (!res.headersSent) res.status(502).json({ success: false, error: err.message });
      });
    };

    pipe(streamUrl);
  } catch (error) {
    console.error('stream error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao fazer proxy do stream.',
      });
    }
  }
}

// Cache compartilhado de URLs (TTL 5min)
const streamUrlCache = new Map();
const STREAM_URL_TTL_MS = 5 * 60 * 1000;

function getCachedStreamUrl(videoId) {
  const entry = streamUrlCache.get(videoId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    streamUrlCache.delete(videoId);
    return null;
  }
  return entry.url;
}

function setCachedStreamUrl(videoId, url) {
  streamUrlCache.set(videoId, { url, expiresAt: Date.now() + STREAM_URL_TTL_MS });
  if (streamUrlCache.size > 200) {
    for (const [k, v] of streamUrlCache) {
      if (Date.now() > v.expiresAt) streamUrlCache.delete(k);
    }
  }
}

async function resolveDirectStreamUrl(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const cleanedUrl = cleanYoutubeUrl(url);

  return new Promise((resolve, reject) => {
    const args = [
      '-g',
      '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '--no-warnings',
      '--no-playlist',
      cleanedUrl,
    ];
    const proc = spawn(YTDLP_PATH, args);
    let out = '';
    let err = '';

    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && out.trim()) {
        const urlLine = out.trim().split('\n')[0].trim();
        if (urlLine.startsWith('http')) resolve(urlLine);
        else reject(new Error('yt-dlp não retornou URL válida.'));
      } else {
        reject(new Error(err || `yt-dlp exited with code ${code}`));
      }
    });
    proc.on('error', reject);

    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) { /* ignore */ }
      reject(new Error('Timeout ao resolver stream.'));
    }, 10_000);
  });
}
