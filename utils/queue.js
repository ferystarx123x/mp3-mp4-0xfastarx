// utils/queue.js
// Manajemen antrian download agar tidak overload server

const PQueue = require('p-queue');
require('dotenv').config();

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT) || 2;

// Buat queue dengan maksimal concurrent download
const downloadQueue = new PQueue({ concurrency: MAX_CONCURRENT });

// Map untuk track user yang sedang dalam antrian
const userQueueMap = new Map();

// Tambah task ke antrian
async function addToQueue(userId, taskFn) {
  // Cek apakah user sudah punya task yang berjalan
  if (userQueueMap.get(userId)) {
    throw new Error('Kamu masih punya download yang sedang berjalan! Tunggu selesai dulu ya 😊');
  }

  // Tandai user sedang dalam proses download
  userQueueMap.set(userId, true);

  try {
    // Tambahkan ke queue dan tunggu hasilnya
    const result = await downloadQueue.add(taskFn);
    return result;
  } finally {
    // Hapus dari tracking setelah selesai (sukses atau gagal)
    userQueueMap.delete(userId);
  }
}

// Cek posisi antrian saat ini
function getQueueStatus() {
  return {
    pending: downloadQueue.pending,   // Sedang diproses
    size: downloadQueue.size,          // Menunggu dalam antrian
    total: downloadQueue.pending + downloadQueue.size
  };
}

// Cek apakah user sedang dalam antrian
function isUserInQueue(userId) {
  return userQueueMap.has(userId);
}

module.exports = {
  addToQueue,
  getQueueStatus,
  isUserInQueue
};
