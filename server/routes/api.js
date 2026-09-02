const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const playlistController = require('../controllers/playlist-controller');
const { resolveStream, streamAudio } = require('../controllers/streamController');

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor do Extrator de Áudio funcionando!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Stream: resolve URL direta do YouTube (chamado pela Edge Function `stream`)
router.get('/stream/resolve', resolveStream);

// Stream: proxy direto com Range support (usado pelo <audio> em dev)
router.get('/stream', streamAudio);

// Metadados do vídeo
router.post('/video-info', audioController.getVideoInfo);

// Extração + conversão
router.post('/extract-audio', audioController.extractAudio);

// Formatos suportados
router.get('/formats', audioController.getSupportedFormats);

// Playlist
router.post('/extract-playlist', playlistController.extractPlaylist);

module.exports = router;
