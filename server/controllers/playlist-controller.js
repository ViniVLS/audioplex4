const path = require('path');
const { execFile } = require('child_process');
const { fetchVideoInfo, isPlaylistUrl } = require('../utils/youtube');

const YTDLP_PATH = path.join(__dirname, '../../bin/yt-dlp.exe');

class PlaylistController {
    constructor() {
        this.extractPlaylist = this.extractPlaylist.bind(this);
    }

    async extractPlaylist(req, res) {
        try {
            const { url } = req.body;

            if (!url || typeof url !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'URL não fornecida'
                });
            }

            if (!isPlaylistUrl(url)) {
                return res.status(400).json({
                    success: false,
                    error: 'URL não é uma playlist'
                });
            }

            const playlistId = this.extractPlaylistId(url);
            const entries = await this.fetchPlaylistEntries(url);

            if (entries.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Playlist vazia ou não encontrada'
                });
            }

            const videos = [];
            const errors = [];

            for (const entry of entries) {
                try {
                    const videoInfo = await fetchVideoInfo(entry.url);
                    videos.push({
                        id: entry.id || videoInfo.id,
                        title: videoInfo.title,
                        url: entry.url,
                        duration: videoInfo.durationSeconds,
                        thumbnail: videoInfo.thumbnail
                    });
                } catch (err) {
                    errors.push({
                        id: entry.id,
                        url: entry.url,
                        error: err.message
                    });
                }
            }

            res.json({
                success: true,
                message: 'Playlist processada',
                playlistId,
                totalVideos: videos.length,
                totalErrors: errors.length,
                videos,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Erro na playlist:', error);
            res.status(500).json({
                success: false,
                error: error.message ? `${error.message} (playlist)` : 'Erro ao processar playlist'
            });
        }
    }

    extractPlaylistId(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('list') || '';
        } catch {
            const match = url.match(/[?&]list=([^&]+)/);
            return match ? match[1] : '';
        }
    }

    fetchPlaylistEntries(url) {
        return new Promise((resolve, reject) => {
            const args = [
                '--flat-playlist',
                '--dump-single-json',
                '--no-warnings',
                '--no-playlist',
                url
            ];

            execFile(YTDLP_PATH, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('yt-dlp playlist error:', stderr || error.message);
                    return reject(new Error('Não foi possível obter informações da playlist.'));
                }

                try {
                    const data = JSON.parse(stdout);
                    const entries = (data.entries || []).map(e => ({
                        id: e.id,
                        url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ''),
                        title: e.title
                    }));
                    resolve(entries);
                } catch (parseErr) {
                    reject(new Error('Erro ao processar dados da playlist.'));
                }
            });
        });
    }
}

module.exports = new PlaylistController();
