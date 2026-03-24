// handlers/bot.js
// Handler utama semua interaksi bot Telegram

const fs = require('fs');
const { setState, getState, clearState, STEPS } = require('../utils/state');
const { addToQueue, getQueueStatus, isUserInQueue } = require('../utils/queue');
const { isYouTubeUrl, extractVideoId, formatBytes, escapeHtml, truncate } = require('../utils/helpers');
const { searchYouTube, getVideoInfo, downloadMP3, downloadMP4, deleteFile, getFileSize } = require('../services/youtube');
const { getLyrics, formatLyricsMessages } = require('../services/lyrics');
require('dotenv').config();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 314572800; // 300MB

// ─────────────────────────────────────────
//  REGISTER SEMUA HANDLER KE BOT
// ─────────────────────────────────────────
function registerHandlers(bot) {

  // ── /start ──────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    clearState(chatId);

    const name = msg.from.first_name || 'Sobat';
    const welcomeText = `
🎵 <b>Halo, ${escapeHtml(name)}!</b> Selamat datang di <b>YT Music Downloader Bot</b>

Aku bisa bantu kamu:
🎵 Download lagu sebagai <b>MP3</b>
🎬 Download video sebagai <b>MP4</b> (360p/720p/1080p)
📝 Cari <b>lirik lagu</b> otomatis

<b>Cara pakai:</b>
1️⃣ Ketik /download lalu masukkan judul atau link YouTube
2️⃣ Pilih lagu dari hasil pencarian
3️⃣ Pilih format & kualitas
4️⃣ Tunggu file & lirik dikirim ke sini!

<b>Perintah tersedia:</b>
/download - Mulai download lagu
/status - Cek status antrian
/help - Bantuan
/cancel - Batalkan proses

⚠️ <i>Bot ini untuk penggunaan pribadi. Hormati hak cipta ya!</i>
    `.trim();

    bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
  });

  // ── /help ───────────────────────────────
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
📖 <b>PANDUAN PENGGUNAAN</b>

<b>🔍 Cara mencari lagu:</b>
• Ketik /download
• Masukkan <b>judul lagu</b> (contoh: <code>Shape of You Ed Sheeran</code>)
• Atau paste <b>link YouTube</b> langsung

<b>📁 Format yang tersedia:</b>
• 🎵 <b>MP3</b> - Audio saja, kualitas terbaik
• 🎬 <b>MP4 360p</b> - Video kecil, hemat data
• 🎬 <b>MP4 720p</b> - Video HD (rekomen)
• 🎬 <b>MP4 1080p</b> - Video Full HD

<b>⚠️ Batas ukuran file:</b>
• Default 50MB, namun sudah diset ke <b>300MB</b> jika bot ini memakai Local API Server.
• Video panjang atau 1080p mungkin melebihi batas.

<b>🎵 Fitur Lirik:</b>
• Lirik dicari otomatis setelah download selesai
• Data lirik dari <b>Genius.com</b>
    `.trim();

    bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
  });

  // ── /status ─────────────────────────────
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const status = getQueueStatus();
    const inQueue = isUserInQueue(chatId);

    let statusText = `📊 <b>Status Server</b>\n\n`;
    statusText += `⚡ Sedang diproses: <b>${status.pending}</b>\n`;
    statusText += `⏳ Dalam antrian: <b>${status.size}</b>\n`;
    statusText += `📦 Total aktif: <b>${status.total}</b>\n\n`;
    statusText += inQueue
      ? `✅ Kamu sedang dalam proses download`
      : `💤 Kamu tidak ada dalam antrian`;

    bot.sendMessage(chatId, statusText, { parse_mode: 'HTML' });
  });

  // ── /cancel ─────────────────────────────
  bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    const state = getState(chatId);

    if (state.step === STEPS.IDLE) {
      bot.sendMessage(chatId, '🤔 Tidak ada proses yang sedang berjalan.');
      return;
    }

    clearState(chatId);
    bot.sendMessage(chatId, '❌ Proses dibatalkan. Ketik /download untuk memulai lagi.');
  });

  // ── /download ────────────────────────────
  bot.onText(/\/download/, (msg) => {
    const chatId = msg.chat.id;
    clearState(chatId);
    setState(chatId, STEPS.WAITING_SEARCH);

    bot.sendMessage(chatId,
      `🔍 <b>Masukkan judul lagu atau link YouTube:</b>\n\n` +
      `Contoh:\n` +
      `• <code>Shape of You Ed Sheeran</code>\n` +
      `• <code>https://www.youtube.com/watch?v=xxx</code>\n\n` +
      `Ketik /cancel untuk membatalkan.`,
      { parse_mode: 'HTML' }
    );
  });

  // ── HANDLE PESAN TEKS BIASA ──────────────
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const state = getState(chatId);

    // ─── Step: Waiting Search Input ───────
    if (state.step === STEPS.WAITING_SEARCH) {
      await handleSearchInput(bot, chatId, text);
      return;
    }

    // ─── Tidak dalam flow ──────────────────
    if (state.step === STEPS.IDLE) {
      bot.sendMessage(chatId,
        `💡 Ketik /download untuk mulai download lagu, atau /help untuk bantuan.`
      );
    }
  });

  // ── HANDLE CALLBACK QUERY (tombol inline) ─
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Acknowledge callback agar tombol tidak loading
    bot.answerCallbackQuery(query.id);

    const state = getState(chatId);

    // ─── Pilih lagu dari hasil pencarian ──
    if (data.startsWith('select_song:')) {
      const index = parseInt(data.split(':')[1]);
      await handleSongSelection(bot, chatId, messageId, index, state);
      return;
    }

    // ─── Pilih format (MP3/MP4) ───────────
    if (data.startsWith('format:')) {
      const format = data.split(':')[1]; // 'mp3' atau 'mp4'
      await handleFormatSelection(bot, chatId, messageId, format, state);
      return;
    }

    // ─── Pilih kualitas audio/video ─────────────
    if (data.startsWith('quality:')) {
      const parts = data.split(':');
      let format = state.data?.format || 'mp4';
      let quality;
      if (parts.length === 3) {
        format = parts[1];
        quality = parts[2];
      } else {
        quality = parts[1];
      }
      await handleQualitySelection(bot, chatId, messageId, format, quality, state);
      return;
    }

    // ─── Tombol batal ─────────────────────
    if (data === 'cancel') {
      clearState(chatId);
      bot.editMessageText('❌ Dibatalkan. Ketik /download untuk mulai lagi.', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  });
}

// ─────────────────────────────────────────
//  HANDLER: INPUT PENCARIAN
// ─────────────────────────────────────────
async function handleSearchInput(bot, chatId, text) {
  const loadingMsg = await bot.sendMessage(chatId, '🔍 <b>Sedang mencari...</b>', { parse_mode: 'HTML' });

  try {
    let videoInfo = null;
    let searchResults = [];

    if (isYouTubeUrl(text)) {
      // Input adalah URL YouTube langsung
      videoInfo = await getVideoInfo(text);
      searchResults = [videoInfo];
    } else {
      // Input adalah judul, search YouTube
      searchResults = await searchYouTube(text);
    }

    // Simpan hasil pencarian ke state
    setState(chatId, STEPS.SHOWING_RESULTS, { searchResults });

    if (searchResults.length === 1 && isYouTubeUrl(text)) {
      // Langsung tampilkan pilihan format jika input URL
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      setState(chatId, STEPS.WAITING_FORMAT, { selectedVideo: searchResults[0] });

      const video = searchResults[0];
      const shortDesc = video.description ? `\n📝 <i>${escapeHtml(truncate(video.description, 200))}</i>\n` : '';
      await bot.sendMessage(chatId,
        `✅ <b>Video ditemukan!</b>\n\n` +
        `🎵 <b>${escapeHtml(video.title)}</b>\n` +
        `👤 ${escapeHtml(video.uploader)}\n` +
        `⏱️ Durasi: ${video.duration}\n` +
        `👁️ Ditonton: ${Number(video.views).toLocaleString('id-ID')} kali\n` +
        shortDesc +
        `\nPilih format download:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: buildFormatKeyboard()
          }
        }
      );
    } else {
      // Tampilkan daftar hasil pencarian
      await bot.deleteMessage(chatId, loadingMsg.message_id);

      let resultText = `🔍 <b>Hasil pencarian</b> (${searchResults.length} lagu ditemukan):\n\n`;
      const buttons = [];

      searchResults.forEach((song, i) => {
        resultText += `${i + 1}. <b>${escapeHtml(truncate(song.title, 60))}</b>\n`;
        resultText += `   👤 ${escapeHtml(song.uploader)} | ⏱️ ${song.duration} | 👁️ ${Number(song.views).toLocaleString('id-ID')} views\n\n`;

        buttons.push([{
          text: `${i + 1}. ${truncate(song.title, 35)}`,
          callback_data: `select_song:${i}`
        }]);
      });

      buttons.push([{ text: '❌ Batal', callback_data: 'cancel' }]);

      await bot.sendMessage(chatId, resultText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }
  } catch (err) {
    console.error('Search error:', err.message);
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    clearState(chatId);
    bot.sendMessage(chatId,
      `❌ <b>Pencarian gagal!</b>\n\n${escapeHtml(err.message)}\n\nCoba lagi dengan /download`,
      { parse_mode: 'HTML' }
    );
  }
}

// ─────────────────────────────────────────
//  HANDLER: PILIH LAGU DARI HASIL SEARCH
// ─────────────────────────────────────────
async function handleSongSelection(bot, chatId, messageId, index, state) {
  const { searchResults } = state.data;

  if (!searchResults || !searchResults[index]) {
    bot.sendMessage(chatId, '❌ Pilihan tidak valid. Ketik /download untuk mulai lagi.');
    return;
  }

  const selectedVideo = searchResults[index];
  setState(chatId, STEPS.WAITING_FORMAT, { selectedVideo });

  const shortDesc = selectedVideo.description ? `\n📝 <i>${escapeHtml(truncate(selectedVideo.description, 200))}</i>\n` : '';
  await bot.editMessageText(
    `✅ <b>Lagu dipilih!</b>\n\n` +
    `🎵 <b>${escapeHtml(selectedVideo.title)}</b>\n` +
    `👤 ${escapeHtml(selectedVideo.uploader)}\n` +
    `⏱️ Durasi: ${selectedVideo.duration}\n` +
    `👁️ Ditonton: ${Number(selectedVideo.views).toLocaleString('id-ID')} kali\n` +
    shortDesc +
    `\nPilih format download:`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buildFormatKeyboard() }
    }
  );
}

// ─────────────────────────────────────────
//  HANDLER: PILIH FORMAT (MP3/MP4)
// ─────────────────────────────────────────
async function handleFormatSelection(bot, chatId, messageId, format, state) {
  const { selectedVideo } = state.data;

  if (!selectedVideo) {
    bot.sendMessage(chatId, '❌ Session expired. Ketik /download untuk mulai lagi.');
    return;
  }

  if (format === 'mp3') {
    setState(chatId, STEPS.WAITING_QUALITY, { selectedVideo, format: 'mp3' });
    await bot.editMessageText(
      `🔊 <b>Pilih kualitas Audio MP3:</b>\n\n` +
      `🎵 ${escapeHtml(selectedVideo.title)}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildMp3QualityKeyboard() }
      }
    );
  } else if (format === 'mp4') {
    setState(chatId, STEPS.WAITING_QUALITY, { selectedVideo, format: 'mp4' });
    await bot.editMessageText(
      `🎬 <b>Pilih kualitas video MP4:</b>\n\n` +
      `🎵 ${escapeHtml(selectedVideo.title)}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildMp4QualityKeyboard() }
      }
    );
  }
}

// ─────────────────────────────────────────
//  HANDLER: PILIH KUALITAS AUDIO/VIDEO
// ─────────────────────────────────────────
async function handleQualitySelection(bot, chatId, messageId, format, quality, state) {
  const { selectedVideo } = state.data;

  if (!selectedVideo) {
    bot.sendMessage(chatId, '❌ Session expired. Ketik /download untuk mulai lagi.');
    return;
  }

  setState(chatId, STEPS.DOWNLOADING, { selectedVideo, format, quality });

  await bot.editMessageText(
    `⏳ <b>Mempersiapkan download ${format.toUpperCase()} ${format === 'mp3' ? quality + 'kbps' : quality + 'p'}...</b>\n\n` +
    `🎵 ${escapeHtml(selectedVideo.title)}\n` +
    `👁️ Ditonton: ${Number(selectedVideo.views).toLocaleString('id-ID')} kali`,
    { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
  );

  await processDownload(bot, chatId, selectedVideo, format, quality);
}

// ─────────────────────────────────────────
//  PROSES DOWNLOAD UTAMA
// ─────────────────────────────────────────
async function processDownload(bot, chatId, video, format, quality) {
  let statusMsg;

  try {
    // Kirim pesan status download
    statusMsg = await bot.sendMessage(chatId,
      `⬇️ <b>Downloading ${format.toUpperCase()}${quality ? ` ${quality}${format === 'mp3' ? 'kbps' : 'p'}` : ''}...</b>\n\n` +
      `🎵 <b>${escapeHtml(truncate(video.title, 50))}</b>\n` +
      `⏱️ Durasi: ${video.duration}\n` +
      `👁️ Ditonton: ${Number(video.views).toLocaleString('id-ID')} kali\n\n` +
      `<i>Mohon tunggu, ini mungkin butuh beberapa menit...</i>`,
      { parse_mode: 'HTML' }
    );

    // Tambahkan ke antrian download
    const filePath = await addToQueue(chatId, async () => {
      if (format === 'mp3') {
        return await downloadMP3(video.url, video.id, quality);
      } else {
        return await downloadMP4(video.url, video.id, quality);
      }
    });

    // Cek ukuran file
    const fileSize = getFileSize(filePath);
    if (fileSize > MAX_FILE_SIZE) {
      deleteFile(filePath);
      await bot.editMessageText(
        `❌ <b>File terlalu besar!</b>\n\n` +
        `Ukuran: ${formatBytes(fileSize)}\n` +
        `Batas Telegram: ${formatBytes(MAX_FILE_SIZE)}\n\n` +
        `💡 Coba pilih kualitas lebih rendah (360p) atau download MP3 saja.`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
      );
      clearState(chatId);
      return;
    }

    // Update status: Mengirim file
    await bot.editMessageText(
      `📤 <b>Mengirim file ke Telegram...</b>\n\n` +
      `🎵 ${escapeHtml(truncate(video.title, 50))}\n` +
      `👁️ Ditonton: ${Number(video.views).toLocaleString('id-ID')} kali\n` +
      `📦 Ukuran: ${formatBytes(fileSize)}`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
    );

    // Kirim file ke Telegram
    const shortDesc = video.description ? `\n📝 <i>${escapeHtml(truncate(video.description, 100))}</i>` : '';
    const caption = `🎵 <b>${escapeHtml(video.title)}</b>\n👤 ${escapeHtml(video.uploader)}\n⏱️ ${video.duration} | 👁️ ${Number(video.views).toLocaleString('id-ID')}x | 📦 ${formatBytes(fileSize)}${shortDesc}`;

    if (format === 'mp3') {
      await bot.sendAudio(chatId, filePath, {
        caption: caption,
        parse_mode: 'HTML',
        title: video.title,
        performer: video.uploader
      });
    } else {
      await bot.sendVideo(chatId, filePath, {
        caption: caption,
        parse_mode: 'HTML',
        supports_streaming: true
      });
    }

    // Hapus file setelah dikirim
    deleteFile(filePath);

    // Hapus pesan status
    await bot.deleteMessage(chatId, statusMsg.message_id);

    // Kirim pesan sukses
    await bot.sendMessage(chatId,
      `✅ <b>Download selesai!</b>\n\n` +
      `Sekarang aku akan cari lirik lagunya...`,
      { parse_mode: 'HTML' }
    );

    // ─── Cari Lirik ──────────────────────
    const lyricMsg = await bot.sendMessage(chatId, `📝 <b>Mencari lirik lagu...</b>`, { parse_mode: 'HTML' });

    const lyricsResult = await getLyrics(video.title, video.uploader);
    const lyricsMessages = formatLyricsMessages(lyricsResult);

    await bot.deleteMessage(chatId, lyricMsg.message_id);

    // Kirim lirik (bisa lebih dari satu pesan jika panjang)
    for (const lyricChunk of lyricsMessages) {
      await bot.sendMessage(chatId, lyricChunk, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    }

    // Reset state
    clearState(chatId);

    // Tawarkan download lagi
    await bot.sendMessage(chatId,
      `\n💡 Mau download lagu lain? Ketik /download`,
      { parse_mode: 'HTML' }
    );

  } catch (err) {
    console.error('Download error:', err.message);
    clearState(chatId);

    const errMsg = err.message.includes('antrian')
      ? err.message
      : `Terjadi kesalahan saat download.\n\n<code>${escapeHtml(err.message)}</code>`;

    if (statusMsg) {
      await bot.editMessageText(`❌ <b>Gagal!</b>\n\n${errMsg}\n\nCoba lagi dengan /download`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'HTML'
      });
    } else {
      await bot.sendMessage(chatId, `❌ <b>Gagal!</b>\n\n${errMsg}\n\nCoba lagi dengan /download`, {
        parse_mode: 'HTML'
      });
    }
  }
}

// ─────────────────────────────────────────
//  KEYBOARD BUILDERS
// ─────────────────────────────────────────
function buildFormatKeyboard() {
  return [
    [
      { text: '🎵 MP3 (Audio)', callback_data: 'format:mp3' },
      { text: '🎬 MP4 (Video)', callback_data: 'format:mp4' }
    ],
    [{ text: '❌ Batal', callback_data: 'cancel' }]
  ];
}

function buildMp3QualityKeyboard() {
  return [
    [
      { text: '🔊 320kbps (Terbaik)', callback_data: 'quality:mp3:320' },
      { text: '🔉 192kbps (Bagus)', callback_data: 'quality:mp3:192' }
    ],
    [
      { text: '🔈 128kbps (Standar)', callback_data: 'quality:mp3:128' }
    ],
    [{ text: '❌ Batal', callback_data: 'cancel' }]
  ];
}

function buildMp4QualityKeyboard() {
  return [
    [
      { text: '📱 144p', callback_data: 'quality:mp4:144' },
      { text: '📱 240p', callback_data: 'quality:mp4:240' },
      { text: '📱 360p', callback_data: 'quality:mp4:360' }
    ],
    [
      { text: '💻 480p', callback_data: 'quality:mp4:480' },
      { text: '💻 720p', callback_data: 'quality:mp4:720' },
      { text: '🖥️ 1080p', callback_data: 'quality:mp4:1080' }
    ],
    [{ text: '❌ Batal', callback_data: 'cancel' }]
  ];
}

module.exports = { registerHandlers };
