/**
 * Utilitários de formatação e sanitização
 */

function sanitizeFilename(filename) {
    if (!filename) return 'audio';
    return filename
        .replace(/[\\/:\*\?"<>\|]/g, '') // remove caracteres proibidos no Windows
        .replace(/[\x00-\x1f\x80-\x9f]/g, '') // remove caracteres de controle
        .replace(/\s+/g, ' ') // normaliza espaços
        .trim()
        .substring(0, 150); // limita o tamanho
}

function formatDuration(seconds) {
    const sec = parseInt(seconds, 10);
    if (isNaN(sec) || sec < 0) return '00:00';
    
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remainingSecs = sec % 60;
    
    const formattedMins = mins.toString().padStart(2, '0');
    const formattedSecs = remainingSecs.toString().padStart(2, '0');
    
    if (hrs > 0) {
        return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
}

function formatViews(views) {
    const count = parseInt(views, 10);
    if (isNaN(count)) return '0';
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
        return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toString();
}

module.exports = {
    sanitizeFilename,
    formatDuration,
    formatViews
};
