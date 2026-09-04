/**
 * Módulo de integração com YouTube usando yt-dlp e FFmpeg
 * Suporte a múltiplos formatos de áudio (MP3, AAC/M4A, WAV, FLAC, OGG)
 */
const path = require('path');
const fs = require('fs-extra');
const { spawn, execFile } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const { formatDuration, formatViews } = require('./formatters');

// Caminho do binário yt-dlp
const YTDLP_PATH = path.join(__dirname, '../../bin/yt-dlp.exe');

// Startup checks
if (!fs.existsSync(YTDLP_PATH)) {
    console.warn(`⚠️ yt-dlp binary not found at ${YTDLP_PATH}. Audio extraction will fail.`);
}
if (!ffmpegStatic) {
    console.warn('⚠️ ffmpeg-static binary not found. Audio conversion will fail.');
}

/**
 * Formatos de áudio suportados e suas configurações FFmpeg
 */
const AUDIO_FORMATS = {
    mp3:  { codec: 'libmp3lame', extension: 'mp3',  label: 'MP3 (MPEG Layer 3)' },
    aac:  { codec: 'aac',        extension: 'm4a',  label: 'AAC (M4A)' },
    wav:  { codec: 'pcm_s16le',  extension: 'wav',  label: 'WAV (Lossless PCM)' },
    flac: { codec: 'flac',       extension: 'flac', label: 'FLAC (Lossless)' },
    ogg:  { codec: 'libvorbis',  extension: 'ogg',  label: 'OGG Vorbis' }
};

/**
 * Valida se a URL é do YouTube (vídeo, shorts, youtu.be, music, embed)
 */
function isValidYoutubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim();
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|music\/)|youtu\.be\/|music\.youtube\.com\/)[\w-]{11}(\S*)?$/;
    return ytRegex.test(cleanUrl);
}

/**
 * Valida se a URL é uma playlist do YouTube
 */
function isPlaylistUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('playlist?list=') || url.includes('&list=');
}

/**
 * Normaliza e limpa a URL do YouTube
 */
function cleanYoutubeUrl(url) {
    if (!url) return '';
    let cleaned = url.trim();
    if (cleaned.includes('youtube.com/shorts/')) {
        const shortId = cleaned.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('&')[0];
        if (shortId) {
            cleaned = `https://www.youtube.com/watch?v=${shortId}`;
        }
    }
    if (cleaned.includes('music.youtube.com')) {
        cleaned = cleaned.replace('music.youtube.com', 'www.youtube.com');
    }
    return cleaned;
}

/**
 * Obtém informações detalhadas do vídeo via yt-dlp
 */
async function fetchVideoInfo(url) {
    const cleanedUrl = cleanYoutubeUrl(url);
    if (!isValidYoutubeUrl(cleanedUrl)) {
        throw new Error('URL do YouTube inválida ou formato não suportado.');
    }

    return new Promise((resolve, reject) => {
        const args = [
            '--dump-single-json',
            '--no-warnings',
            '--no-playlist',
            '--skip-download',
            cleanedUrl
        ];

        execFile(YTDLP_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Erro ao executar yt-dlp:', stderr || error.message);
                return reject(new Error('Não foi possível obter informações do vídeo. Verifique a URL e a conexão.'));
            }

            try {
                const info = JSON.parse(stdout);
                
                let bestThumbnail = info.thumbnail;
                if (info.thumbnails && info.thumbnails.length > 0) {
                    bestThumbnail = info.thumbnails[info.thumbnails.length - 1].url;
                }

                resolve({
                    id: info.id,
                    title: info.title || 'Áudio do YouTube',
                    author: info.uploader || info.channel || 'Desconhecido',
                    authorUrl: info.uploader_url || info.channel_url || '',
                    durationSeconds: info.duration || 0,
                    formattedDuration: formatDuration(info.duration || 0),
                    thumbnail: bestThumbnail,
                    views: info.view_count || 0,
                    formattedViews: formatViews(info.view_count || 0),
                    uploadDate: info.upload_date || '',
                    description: info.description ? info.description.substring(0, 250) : '',
                    url: info.webpage_url || cleanedUrl
                });
            } catch (parseError) {
                console.error('Erro ao fazer parse do JSON do vídeo:', parseError);
                reject(new Error('Erro ao processar dados retornados do YouTube.'));
            }
        });
    });
}

/**
 * Converte e extrai áudio diretamente para o formato especificado
 * @param {string} url - URL do vídeo
 * @param {string} outputPath - Caminho de saída (template com %(ext)s)
 * @param {string} bitrate - Bitrate desejado (ex: '320k', '256k', '128k')
 * @param {string} format - Formato de saída: 'mp3', 'aac', 'wav', 'flac', 'ogg'
 */
function downloadAndConvertAudio(url, outputPath, bitrate = '320k', format = 'mp3') {
    const cleanedUrl = cleanYoutubeUrl(url);
    const formatConfig = AUDIO_FORMATS[format] || AUDIO_FORMATS.mp3;

    if (!ffmpegStatic) {
        return Promise.reject(new Error('FFmpeg binary not available. Audio conversion cannot proceed.'));
    }

    return new Promise((resolve, reject) => {
        // Mapear bitrate para qualidade de áudio do yt-dlp
        let qualityArg = '0';
        if (bitrate === '256k' || bitrate === '256') {
            qualityArg = '2';
        } else if (bitrate === '128k' || bitrate === '128') {
            qualityArg = '5';
        }

        const args = [
            '-x',
            '--audio-format', formatConfig.extension === 'm4a' ? 'aac' : format,
            '--audio-quality', qualityArg,
            '--ffmpeg-location', ffmpegStatic,
            '--embed-thumbnail',
            '--add-metadata',
            '--no-playlist',
            '--no-warnings',
            '-o', outputPath,
            cleanedUrl
        ];

        // WAV e FLAC não precisam de --embed-thumbnail (não suportado)
        if (format === 'wav' || format === 'flac') {
            const thumbIdx = args.indexOf('--embed-thumbnail');
            if (thumbIdx !== -1) args.splice(thumbIdx, 1);
        }

        console.log(`⚡ Iniciando extração e conversão para ${formatConfig.label} (${bitrate})...`);
        const proc = spawn(YTDLP_PATH, args);

        let stderrData = '';

        proc.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line.includes('[download]') || line.includes('[ExtractAudio]')) {
                console.log(`   ${line}`);
            }
        });

        proc.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Áudio convertido com sucesso (${formatConfig.label}): ${outputPath}`);
                resolve();
            } else {
                console.error('Erro no processo de conversão:', stderrData);
                reject(new Error(`Falha na extração e conversão do áudio (código ${code}).`));
            }
        });

        proc.on('error', (err) => {
            console.error('Erro ao iniciar processo:', err.message);
            reject(err);
        });
    });
}

module.exports = {
    AUDIO_FORMATS,
    isValidYoutubeUrl,
    isPlaylistUrl,
    cleanYoutubeUrl,
    fetchVideoInfo,
    downloadAndConvertAudio
};
