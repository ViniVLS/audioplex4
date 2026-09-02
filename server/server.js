const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const apiRoutes = require('./routes/api');
const { downloadFile } = require('./controllers/audioController');
const playlistController = require('./controllers/playlist-controller');

const app = express();
const PORT = process.env.PORT || 3000;

// Garantir que a pasta de downloads exista
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
fs.ensureDirSync(DOWNLOADS_DIR);

// Middlewares
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do Angular
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/api', apiRoutes);

// Rota para extrair playlists
app.post('/api/extract-playlist', playlistController.extractPlaylist);

// Rota direta para download de arquivos
app.get('/download/:fileName', downloadFile);

// Rota catch-all para Angular SPA - servir index.html para rotas não-API e não-download
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/download')) {
        const indexPath = path.join(__dirname, '../public/index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.json({
                name: 'YouTube Audio Extractor API',
                version: '1.0.0',
                status: 'Online'
            });
        }
    }
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error('⚠️ Erro interno do servidor:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno no servidor. Tente novamente mais tarde.'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n==================================================');
    console.log('🎵 YOUTUBE AUDIO EXTRACTOR (MP3 320kbps/256kbps)');
    console.log('==================================================');
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
    console.log('==================================================\n');
});

// Capturar erros não tratados do processo
process.on('uncaughtException', (error) => {
    console.error('🚨 Exceção não capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Promessa rejeitada não tratada:', reason);
});
