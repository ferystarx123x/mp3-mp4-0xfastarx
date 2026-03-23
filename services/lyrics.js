// services/lyrics.js
// Fetch lirik lagu dari Genius API

const axios = require('axios');
require('dotenv').config();

const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
const GENIUS_API_BASE = 'https://api.genius.com';

// Bersihkan judul video YouTube agar lebih cocok untuk search lirik
// Contoh: "Ed Sheeran - Shape of You (Official Video)" → "Ed Sheeran Shape of You"
function cleanTitle(title) {
  return title
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\[Official.*?\]/gi, '')
    .replace(/\(Lyrics.*?\)/gi, '')
    .replace(/\[Lyrics.*?\]/gi, '')
    .replace(/\(Audio.*?\)/gi, '')
    .replace(/\[Audio.*?\]/gi, '')
    .replace(/\(Music Video\)/gi, '')
    .replace(/\[Music Video\]/gi, '')
    .replace(/\(ft\..*?\)/gi, '')
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Search lagu di Genius
async function searchGenius(query) {
  if (!GENIUS_API_KEY) {
    throw new Error('GENIUS_API_KEY belum diset di .env');
  }

  const cleanQuery = cleanTitle(query);

  try {
    const response = await axios.get(`${GENIUS_API_BASE}/search`, {
      headers: {
        Authorization: `Bearer ${GENIUS_API_KEY}`
      },
      params: {
        q: cleanQuery
      },
      timeout: 10000
    });

    const hits = response.data.response.hits;
    if (!hits || hits.length === 0) {
      return null;
    }

    // Ambil hasil pertama yang paling relevan
    const song = hits[0].result;
    return {
      title: song.title,
      artist: song.primary_artist.name,
      url: song.url,
      id: song.id
    };
  } catch (err) {
    console.error('Genius search error:', err.message);
    return null;
  }
}

// Scrape lirik dari halaman Genius menggunakan regex sederhana
// (Genius tidak menyediakan endpoint lirik langsung di free tier)
async function scrapeLyrics(geniusUrl) {
  try {
    const response = await axios.get(geniusUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const html = response.data;

    // Ekstrak lirik dari data-lyrics-container
    const matches = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);

    if (!matches || matches.length === 0) {
      return null;
    }

    let lyrics = '';
    for (const match of matches) {
      // Hapus tag HTML, ganti <br> dengan newline
      const cleaned = match
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      lyrics += cleaned + '\n\n';
    }

    return lyrics.trim();
  } catch (err) {
    console.error('Scrape lyrics error:', err.message);
    return null;
  }
}

// Main function: cari dan ambil lirik berdasarkan judul video
async function getLyrics(videoTitle, uploader = '') {
  try {
    // Coba search dengan judul + uploader (artist)
    let songInfo = await searchGenius(`${uploader} ${videoTitle}`);

    // Kalau tidak ketemu, coba dengan judul saja
    if (!songInfo) {
      songInfo = await searchGenius(videoTitle);
    }

    if (!songInfo) {
      return {
        found: false,
        message: '❌ Lirik tidak ditemukan untuk lagu ini.'
      };
    }

    // Ambil lirik dari halaman Genius
    const lyrics = await scrapeLyrics(songInfo.url);

    if (!lyrics) {
      return {
        found: false,
        title: songInfo.title,
        artist: songInfo.artist,
        url: songInfo.url,
        message: `❌ Lirik tidak bisa diambil, tapi bisa dilihat di:\n${songInfo.url}`
      };
    }

    return {
      found: true,
      title: songInfo.title,
      artist: songInfo.artist,
      url: songInfo.url,
      lyrics: lyrics
    };
  } catch (err) {
    console.error('getLyrics error:', err.message);
    return {
      found: false,
      message: '❌ Terjadi kesalahan saat mengambil lirik.'
    };
  }
}

// Format lirik untuk dikirim via Telegram (max 4096 karakter per pesan)
function formatLyricsMessages(lyricsResult) {
  if (!lyricsResult.found) {
    return [lyricsResult.message];
  }

  const header = `🎵 *${escapeMarkdown(lyricsResult.title)}*\n👤 ${escapeMarkdown(lyricsResult.artist)}\n\n`;
  const footer = `\n\n🔗 [Lirik lengkap di Genius](${lyricsResult.url})`;
  const fullText = header + lyricsResult.lyrics + footer;

  // Pecah jadi beberapa pesan jika terlalu panjang
  const MAX_LENGTH = 4000;
  const messages = [];

  if (fullText.length <= MAX_LENGTH) {
    messages.push(fullText);
  } else {
    // Kirim header + sebagian lirik dulu
    const lines = lyricsResult.lyrics.split('\n');
    let currentMsg = header;

    for (const line of lines) {
      if ((currentMsg + line + '\n').length > MAX_LENGTH) {
        messages.push(currentMsg);
        currentMsg = line + '\n';
      } else {
        currentMsg += line + '\n';
      }
    }

    if (currentMsg.trim()) {
      messages.push(currentMsg + footer);
    }
  }

  return messages;
}

// Escape karakter khusus Markdown Telegram
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
  getLyrics,
  formatLyricsMessages,
  escapeMarkdown
};
