const ytdl = require('ytdl-core');
const fs = require('fs-extra');
const path = require('path');

class PlaylistController {
    async extractPlaylist(req, res) {
        try {
            const { url } = req.body;

            if (!url.includes('playlist')) {
                return res.status(400).json({
                    success: false,
                    error: 'URL não é uma playlist'
                });
            }

            const playlistId = url.split('list=')[1] || '';
            const videos = [];

            const playlistInfo = await ytdl.getPlaylist(url);

            for (const videoEntry of playlistInfo.entries) {
                const videoInfo = await ytdl.getInfo(videoEntry.url);
                videos.push({
                    id: videoEntry.videoId,
                    title: videoInfo.title,
                    url: videoEntry.url,
                    duration: videoInfo.durationSeconds
                });
            }

            res.json({
                success: true,
                message: 'Playlist processada',
                playlistId,
                totalVideos: videos.length,
                videos
            });

        } catch (error) {
            console.error('Erro na playlist:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao processar playlist'
            });
        }
    }
}

module.exports = new PlaylistController();