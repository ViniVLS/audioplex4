const path = require('path');
const fs = require('fs-extra');
const { fetchVideoInfo, downloadAndConvertAudio, isValidYoutubeUrl, AUDIO_FORMATS } = require('../utils/youtube');
const { sanitizeFilename } = require('../utils/formatters');

const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');
fs.ensureDirSync(DOWNLOADS_DIR);

/**
 * Controller para obter informações do vídeo
 */
async function getVideoInfo(req, res) {
    try {
        const { url } = req.body;

        if (!url || !isValidYoutubeUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'URL do YouTube inválida ou não informada.'
            });
        }

        const videoInfo = await fetchVideoInfo(url);
        return res.json({
            success: true,
            videoInfo
        });
    } catch (error) {
        console.error('Erro ao obter informações do vídeo:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao processar informações do vídeo.'
        });
    }
}

/**
 * Controller para converter e extrair o áudio em múltiplos formatos
 */
async function extractAudio(req, res) {
    try {
        const { url, quality = '320', format = 'mp3' } = req.body;

        if (!url || !isValidYoutubeUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'URL do YouTube inválida ou não informada.'
            });
        }

        // Validar formato
        const formatConfig = AUDIO_FORMATS[format] || AUDIO_FORMATS.mp3;
        const ext = formatConfig.extension;

        // Determinar o bitrate do áudio
        let audioBitrate = '320k';
        if (quality === 'medium' || quality === '256' || quality === '256k') {
            audioBitrate = '256k';
        } else if (quality === 'standard' || quality === 'low' || quality === '128' || quality === '128k') {
            audioBitrate = '128k';
        }

        console.log(`📥 Iniciando extração: ${url} (Qualidade: ${audioBitrate}, Formato: ${formatConfig.label})`);

        // Obter informações do vídeo para nome do arquivo
        const videoInfo = await fetchVideoInfo(url);
        
        // Formatar nome: Artista - Título
        let baseName = videoInfo.title;
        if (videoInfo.author && !videoInfo.title.toLowerCase().includes(videoInfo.author.toLowerCase())) {
            baseName = `${videoInfo.author} - ${videoInfo.title}`;
        }
        
        const safeTitle = sanitizeFilename(baseName);
        const fileName = `${safeTitle} [${audioBitrate}].${ext}`;
        const tempTemplate = path.join(DOWNLOADS_DIR, `${safeTitle} [${audioBitrate}].%(ext)s`);
        const targetFilePath = path.join(DOWNLOADS_DIR, fileName);

        // Executar extração e conversão
        await downloadAndConvertAudio(url, tempTemplate, audioBitrate, format);

        // Verificar tamanho do arquivo gerado
        let sizeInMB = 'Desconhecido';
        let sizeBytes = 0;
        if (await fs.pathExists(targetFilePath)) {
            const stats = await fs.stat(targetFilePath);
            sizeBytes = stats.size;
            sizeInMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
        }

        return res.json({
            success: true,
            message: `Áudio extraído e convertido para ${formatConfig.label} com sucesso!`,
            fileName: fileName,
            downloadUrl: `/download/${encodeURIComponent(fileName)}`,
            fileSize: sizeInMB,
            fileSizeBytes: sizeBytes,
            bitrate: audioBitrate,
            format: format,
            formatLabel: formatConfig.label,
            videoInfo: {
                title: videoInfo.title,
                author: videoInfo.author,
                duration: videoInfo.durationSeconds,
                formattedDuration: videoInfo.formattedDuration,
                thumbnail: videoInfo.thumbnail
            }
        });

    } catch (error) {
        console.error('❌ Erro na rota /api/extract-audio:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao processar e converter o áudio.'
        });
    }
}

/**
 * Controller para servir o download do arquivo
 */
function downloadFile(req, res) {
    try {
        const fileName = decodeURIComponent(req.params.fileName);
        const filePath = path.join(DOWNLOADS_DIR, fileName);

        // Path traversal protection: ensure resolved path is within DOWNLOADS_DIR
        const resolvedPath = path.resolve(filePath);
        const resolvedDownloadsDir = path.resolve(DOWNLOADS_DIR);
        if (!resolvedPath.startsWith(resolvedDownloadsDir + path.sep) && resolvedPath !== resolvedDownloadsDir) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado.'
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Arquivo não encontrado ou já expirado.'
            });
        }

        res.download(filePath, fileName, (err) => {
            if (err && !res.headersSent) {
                console.error('Erro ao transferir download:', err.message);
            }
            // Agendar exclusão do arquivo temporário após 5 minutos
            setTimeout(async () => {
                try {
                    if (await fs.pathExists(filePath)) {
                        await fs.unlink(filePath);
                        console.log(`🗑️ Arquivo temporário removido: ${fileName}`);
                    }
                } catch (cleanupErr) {
                    console.error('Erro ao remover arquivo temporário:', cleanupErr.message);
                }
            }, 300000);
        });
    } catch (error) {
        console.error('Erro no controller de download:', error.message);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                error: 'Erro ao transferir arquivo.'
            });
        }
    }
}

/**
 * Controller para retornar os formatos de áudio suportados
 */
function getSupportedFormats(req, res) {
    const formats = Object.entries(AUDIO_FORMATS).map(([key, val]) => ({
        id: key,
        extension: val.extension,
        label: val.label
    }));
    res.json({ success: true, formats });
}

module.exports = {
    getVideoInfo,
    extractAudio,
    downloadFile,
    getSupportedFormats
};
