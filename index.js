// index.js
// Entry point - Inisialisasi bot Telegram

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { checkYtDlp, checkFfmpeg } = require('./services/youtube');
const { registerHandlers } = require('./handlers/bot');

// ─────────────────────────────────────────
//  VALIDASI ENVIRONMENT
// ─────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || './downloads';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN belum diset di file .env!');
  process.exit(1);
}

if (!process.env.GENIUS_API_KEY) {
  console.warn('⚠️  GENIUS_API_KEY belum diset. Fitur lirik tidak akan berfungsi.');
}

// ─────────────────────────────────────────
//  VALIDASI DEPENDENSI SISTEM
// ─────────────────────────────────────────
console.log('\n🔍 Mengecek dependensi sistem...');

if (!checkYtDlp()) {
  console.error('❌ yt-dlp tidak ditemukan!');
  console.error('   Install dengan: pip install yt-dlp');
  console.error('   Atau: sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp');
  process.exit(1);
}
console.log('✅ yt-dlp ditemukan');

if (!checkFfmpeg()) {
  console.warn('⚠️  ffmpeg tidak ditemukan! Konversi MP3 dan merge MP4 mungkin gagal.');
  console.warn('   Install dengan: sudo apt install ffmpeg');
} else {
  console.log('✅ ffmpeg ditemukan');
}

// Cek cookies
const cookiesPath = process.env.COOKIES_PATH || './cookies.txt';
if (fs.existsSync(cookiesPath)) {
  console.log(`✅ cookies.txt ditemukan di: ${cookiesPath}`);
} else {
  console.warn(`⚠️  cookies.txt tidak ditemukan di: ${cookiesPath}`);
  console.warn('   Bot mungkin tidak bisa download di VPS. Baca README.md untuk cara export cookies.');
}

// Buat folder downloads jika belum ada
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
  console.log(`📁 Folder downloads dibuat: ${DOWNLOAD_PATH}`);
}

// ─────────────────────────────────────────
//  INISIALISASI BOT
// ─────────────────────────────────────────
console.log('\n🤖 Menginisialisasi bot Telegram...');

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Register semua handler
registerHandlers(bot);

// ─────────────────────────────────────────
//  EVENT LISTENERS BOT
// ─────────────────────────────────────────

// Bot berhasil terhubung
bot.getMe().then((botInfo) => {
  console.log(`✅ Bot berjalan sebagai: @${botInfo.username}`);
  console.log(`📋 Nama: ${botInfo.first_name}`);
  console.log('\n🚀 Bot siap menerima perintah!\n');
  console.log('─'.repeat(40));
}).catch((err) => {
  console.error('❌ Gagal terhubung ke Telegram:', err.message);
  process.exit(1);
});

// Handle error polling
bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM') {
    console.error('❌ Telegram API error:', error.message);
  } else {
    console.error('❌ Polling error:', error.message);
  }
});

// Handle error umum
bot.on('error', (error) => {
  console.error('❌ Bot error:', error.message);
});

// ─────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n⚠️  Menerima signal ${signal}. Mematikan bot...`);

  // Hapus semua file temporary di folder downloads
  try {
    const files = fs.readdirSync(DOWNLOAD_PATH);
    files.forEach(file => {
      fs.unlinkSync(path.join(DOWNLOAD_PATH, file));
    });
    if (files.length > 0) {
      console.log(`🗑️  ${files.length} file temporary dihapus.`);
    }
  } catch (err) {
    // Ignore error saat cleanup
  }

  bot.stopPolling();
  console.log('👋 Bot berhasil dimatikan.\n');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exception agar bot tidak crash
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
  // Jangan exit, biarkan bot terus berjalan
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Jangan exit
});
