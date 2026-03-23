// utils/state.js
// Manajemen state/session per user (karena bot bersifat stateless)

// Simpan state user di memory (Map)
// Format: userId → { step, data }
const userStates = new Map();

// Step yang tersedia dalam alur bot
const STEPS = {
  IDLE: 'idle',
  WAITING_SEARCH: 'waiting_search',       // Menunggu input judul/link
  SHOWING_RESULTS: 'showing_results',     // Menampilkan hasil pencarian
  WAITING_FORMAT: 'waiting_format',       // Menunggu pilihan MP3/MP4
  WAITING_QUALITY: 'waiting_quality',     // Menunggu pilihan kualitas video
  DOWNLOADING: 'downloading'              // Sedang proses download
};

// Set state user
function setState(userId, step, data = {}) {
  userStates.set(String(userId), { step, data, updatedAt: Date.now() });
}

// Get state user
function getState(userId) {
  return userStates.get(String(userId)) || { step: STEPS.IDLE, data: {} };
}

// Hapus state user (reset ke IDLE)
function clearState(userId) {
  userStates.delete(String(userId));
}

// Bersihkan state yang sudah expired (lebih dari 30 menit)
function cleanExpiredStates() {
  const EXPIRE_TIME = 30 * 60 * 1000; // 30 menit
  const now = Date.now();

  for (const [userId, state] of userStates.entries()) {
    if (now - state.updatedAt > EXPIRE_TIME) {
      userStates.delete(userId);
    }
  }
}

// Jalankan cleanup setiap 10 menit
setInterval(cleanExpiredStates, 10 * 60 * 1000);

module.exports = {
  setState,
  getState,
  clearState,
  STEPS
};
