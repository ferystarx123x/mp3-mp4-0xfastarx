// services/youtube.js
// Handle search YouTube dan download MP3/MP4 menggunakan yt-dlp

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || './downloads';
const COOKIES_PATH = process.env.COOKIES_PATH || './cookies.txt';

// Ambil path lengkap ke eksekusi Node.js yang sedang berjalan (untuk dipakai fitur Javascript milik yt-dlp)
const NODE_PATH = process.execPath;

// Pastikan folder downloads ada
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
}

// Cek apakah yt-dlp tersedia di sistem
function checkYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Cek apakah ffmpeg tersedia di sistem
function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Build argumen cookies untuk yt-dlp
function getCookiesArg() {
  if (fs.existsSync(COOKIES_PATH)) {
    return `--cookies "${COOKIES_PATH}"`;
  }
  console.warn('⚠️  cookies.txt tidak ditemukan. Download mungkin gagal di VPS.');
  return '';
}

// Helper format detik ke M:SS
function formatSeconds(sec) {
  if (!sec) return 'N/A';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Search YouTube berdasarkan query judul
async function searchYouTube(query) {
  return new Promise((resolve, reject) => {
    const cookiesArg = getCookiesArg();
    // Pakai --dump-json --flat-playlist agar output JSON reliable di semua versi yt-dlp
    const cmd = `yt-dlp ${cookiesArg} --js-runtimes "node:${NODE_PATH}" "ytsearch5:${query}" --dump-json --flat-playlist --no-playlist 2>&1`;

    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (!stdout || stdout.trim() === '') {
        return reject(new Error('Tidak ada hasil ditemukan. Coba kata kunci lain.'));
      }

      const results = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.id && data.title) {
            results.push({
              id: data.id,
              title: data.title,
              duration: data.duration_string || formatSeconds(data.duration) || 'N/A',
              uploader: data.uploader || data.channel || data.uploader_id || 'Unknown',
              url: `https://www.youtube.com/watch?v=${data.id}`
            });
          }
        } catch (e) {
          // Skip baris yang bukan JSON valid (misal pesan warning yt-dlp)
          continue;
        }
      }

      if (results.length === 0) {
        return reject(new Error('Tidak ada hasil ditemukan. Coba kata kunci lain.'));
      }

      resolve(results);
    });
  });
}

// Ambil info video dari URL
async function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const cookiesArg = getCookiesArg();
    // Pakai --dump-json untuk dapat semua info video dalam format JSON
    const cmd = `yt-dlp ${cookiesArg} --js-runtimes "node:${NODE_PATH}" "${url}" --dump-json --no-playlist 2>&1`;

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (!stdout || stdout.trim() === '') {
        return reject(new Error('Gagal mengambil info video. Pastikan link valid.'));
      }

      try {
        // Ambil baris pertama yang valid JSON
        const lines = stdout.trim().split('\n');
        let data = null;
        for (const line of lines) {
          try {
            data = JSON.parse(line);
            break;
          } catch (e) {
            continue;
          }
        }

        if (!data || !data.id) {
          return reject(new Error('Format info video tidak valid'));
        }

        resolve({
          id: data.id,
          title: data.title,
          duration: data.duration_string || formatSeconds(data.duration) || 'N/A',
          uploader: data.uploader || data.channel || data.uploader_id || 'Unknown',
          filesize: data.filesize_approx || null,
          url: url
        });
      } catch (e) {
        reject(new Error('Gagal parse info video: ' + e.message));
      }
    });
  });
}

// Download MP3 dengan pilihan kualitas
async function downloadMP3(url, videoId, quality = '320') {
  return new Promise((resolve, reject) => {
    const cookiesArg = getCookiesArg();
    const outputPath = path.join(DOWNLOAD_PATH, `${videoId}_${quality}.%(ext)s`);

    let audioQualityArg = '0'; // default best
    if (quality === '320') audioQualityArg = '320K';
    else if (quality === '192') audioQualityArg = '192K';
    else if (quality === '128') audioQualityArg = '128K';

    const cmd = `yt-dlp ${cookiesArg} --js-runtimes "node:${NODE_PATH}" -f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality ${audioQualityArg} -o "${outputPath}" --no-playlist "${url}" 2>&1`;

    exec(cmd, { timeout: 180000 }, (error, stdout, stderr) => {
      const output = stdout || '';
      if (error && !output.includes('[download] Destination')) {
        console.error('Download MP3 error details:', output || error.message);
        const errMsgMatch = output.match(/ERROR[:].+/g);
        const errMsg = errMsgMatch ? errMsgMatch.join(' | ') : error.message;
        return reject(new Error('Gagal mendownload MP3: ' + errMsg));
      }

      const files = fs.readdirSync(DOWNLOAD_PATH);
      const downloaded = files.find(f => f.startsWith(`${videoId}_${quality}`) && f.endsWith('.mp3'));

      if (downloaded) {
        resolve(path.join(DOWNLOAD_PATH, downloaded));
      } else {
        const fallback = files.find(f => f.startsWith(videoId) && f.endsWith('.mp3'));
        if (fallback) {
          resolve(path.join(DOWNLOAD_PATH, fallback));
        } else {
          reject(new Error('File MP3 tidak ditemukan setelah download'));
        }
      }
    });
  });
}

// Download MP4 dengan pilihan kualitas
async function downloadMP4(url, videoId, quality = '720') {
  return new Promise((resolve, reject) => {
    const cookiesArg = getCookiesArg();
    const outputPath = path.join(DOWNLOAD_PATH, `${videoId}_${quality}.%(ext)s`);

    // Map kualitas ke format yt-dlp
    let formatSelector;
    switch (quality) {
      case '144':
      case '240':
      case '360':
      case '480':
      case '720':
      case '1080':
        formatSelector = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best`;
        break;
      default:
        formatSelector = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]/best';
    }

    const cmd = `yt-dlp ${cookiesArg} --js-runtimes "node:${NODE_PATH}" -f "${formatSelector}" --merge-output-format mp4 -o "${outputPath}" --no-playlist "${url}" 2>&1`;

    exec(cmd, { timeout: 360000 }, (error, stdout, stderr) => {
      const output = stdout || '';
      if (error && !output.includes('[download] Destination') && !output.includes('Merging')) {
        console.error('Download MP4 error details:', output || error.message);
        const errMsgMatch = output.match(/ERROR[:].+/g);
        const errMsg = errMsgMatch ? errMsgMatch.join(' | ') : error.message;
        return reject(new Error('Gagal mendownload MP4: ' + errMsg));
      }

      // Cari file yang sudah didownload
      const files = fs.readdirSync(DOWNLOAD_PATH);
      const downloaded = files.find(f => f.startsWith(`${videoId}_${quality}`) && f.endsWith('.mp4'));

      if (downloaded) {
        resolve(path.join(DOWNLOAD_PATH, downloaded));
      } else {
        // Coba cari file mp4 dengan videoId saja
        const fallback = files.find(f => f.startsWith(videoId) && (f.endsWith('.mp4') || f.endsWith('.mkv')));
        if (fallback) {
          resolve(path.join(DOWNLOAD_PATH, fallback));
        } else {
          reject(new Error('File MP4 tidak ditemukan setelah download'));
        }
      }
    });
  });
}

// Hapus file setelah dikirim ke Telegram
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  File dihapus: ${filePath}`);
    }
  } catch (err) {
    console.error('Gagal hapus file:', err.message);
  }
}

// Cek ukuran file
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

module.exports = {
  checkYtDlp,
  checkFfmpeg,
  searchYouTube,
  getVideoInfo,
  downloadMP3,
  downloadMP4,
  deleteFile,
  getFileSize
};