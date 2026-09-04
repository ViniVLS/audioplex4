const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const apiRoutes = require('./routes/api');
const playerRoutes = require('./controllers/player-controller');
const { downloadFile } = require('./controllers/audioController');
const playlistController = require('./controllers/playlist-controller');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory rate limiter for API endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { start: now, count: 1 });
        return next();
    }
    record.count++;
    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ success: false, error: 'Too many requests. Try again later.' });
    }
    next();
}

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap) {
        if (now - record.start > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(ip);
    }
}, 300_000);

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

// Rotas da API com rate limiting
app.use('/api', rateLimit, apiRoutes);
app.use('/api/player', rateLimit, playerRoutes);

// Rota para extrair playlists
app.post('/api/extract-playlist', rateLimit, playlistController.extractPlaylist);

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
    } else {
        // API route not found
        res.status(404).json({
            success: false,
            error: 'Endpoint não encontrado'
        });
    }
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error('⚠️ Erro interno do servidor:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Erro interno no servidor. Tente novamente mais tarde.'
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
