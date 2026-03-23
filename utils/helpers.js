// utils/helpers.js
// Fungsi-fungsi helper umum

// Format bytes ke ukuran yang mudah dibaca
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Cek apakah string adalah URL YouTube yang valid
function isYouTubeUrl(text) {
  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i;
  return ytRegex.test(text.trim());
}

// Ekstrak video ID dari URL YouTube
function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Format durasi dari detik ke MM:SS atau HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Buat progress bar sederhana
function makeProgressBar(percent, length = 10) {
  const filled = Math.round(percent / 100 * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Escape HTML untuk pesan Telegram (mode HTML)
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Truncate teks panjang
function truncate(text, maxLength = 50) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Sleep / delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  formatBytes,
  isYouTubeUrl,
  extractVideoId,
  formatDuration,
  makeProgressBar,
  escapeHtml,
  truncate,
  sleep
};
