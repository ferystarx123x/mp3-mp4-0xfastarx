# 🎵 YT Telegram Bot - YouTube Downloader + Lirik

Bot Telegram untuk download lagu dari YouTube dalam format MP3/MP4, dilengkapi fitur pencarian lirik otomatis.

---

## 📋 Fitur

- 🔍 **Cari lagu** by judul atau langsung paste link YouTube
- 🎵 **Download MP3** - audio kualitas terbaik
- 🎬 **Download MP4** - pilihan kualitas 360p / 720p / 1080p
- 📝 **Lirik otomatis** - dicari dari Genius.com setelah download
- ⏳ **Antrian download** - tidak overload server
- 🍪 **Cookies support** - untuk menghindari blokir di VPS

---

## 🛠️ Persyaratan Sistem

| Tools | Versi | Keterangan |
|-------|-------|------------|
| Node.js | >= 16.0 | Runtime JavaScript |
| yt-dlp | Latest | Tool download YouTube |
| ffmpeg | Latest | Konversi audio/video |
| Python 3 | >= 3.7 | Diperlukan yt-dlp |

---

## 🚀 Instalasi

### 1. Clone & Install dependencies Node.js

```bash
git clone <repo-url>
cd yt-telegram-bot
npm install
```

### 2. Install yt-dlp

```bash
# Linux/VPS (Rekomendasi)
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Atau via pip
pip install yt-dlp

# Update yt-dlp (lakukan rutin agar tidak error)
yt-dlp -U
```

### 3. Install ffmpeg

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg -y

# CentOS/RHEL
sudo yum install ffmpeg -y

# Verifikasi
ffmpeg -version
```

### 4. Setup file .env

```bash
cp .env.example .env
nano .env
```

Isi dengan data kamu:
```env
TELEGRAM_BOT_TOKEN=token_dari_botfather
GENIUS_API_KEY=api_key_dari_genius
COOKIES_PATH=./cookies.txt
DOWNLOAD_PATH=./downloads
MAX_FILE_SIZE=52428800
MAX_CONCURRENT=2
```

---

## 🍪 Setup Cookies (PENTING untuk VPS!)

Tanpa cookies, bot sering gagal download di VPS karena YouTube memblokir request yang dianggap bot.

### Cara Export Cookies dari Browser:

**Chrome / Edge:**
1. Install ekstensi: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Buka [youtube.com](https://youtube.com) dan **pastikan sudah login**
3. Klik ikon ekstensi → pilih "Export"
4. Simpan sebagai `cookies.txt`

**Firefox:**
1. Install ekstensi: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
2. Buka [youtube.com](https://youtube.com) dan **pastikan sudah login**
3. Klik ikon ekstensi → Export
4. Simpan sebagai `cookies.txt`

### Upload cookies.txt ke VPS:

```bash
# Dari PC lokal ke VPS
scp cookies.txt user@ip-vps:/path/to/yt-telegram-bot/cookies.txt

# Atau gunakan SFTP / FileZilla
```

> ⚠️ **PENTING:** Cookies bisa expired dalam beberapa minggu/bulan. Jika bot mulai error lagi, export ulang cookies dari browser.

> 🔒 **KEAMANAN:** Jangan pernah share file `cookies.txt` atau upload ke GitHub! File ini sama seperti password YouTube kamu.

---

## 🔑 Mendapatkan API Keys

### Telegram Bot Token:
1. Buka [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot`
3. Ikuti instruksi, masukkan nama dan username bot
4. Copy token yang diberikan ke `.env`

### Genius API Key (untuk lirik):
1. Buka [genius.com/api-clients](https://genius.com/api-clients)
2. Login atau daftar akun Genius
3. Klik "New API Client"
4. Isi form (nama app bebas, App Website URL: `http://localhost`)
5. Copy "Client Access Token" ke `.env`

---

## ▶️ Menjalankan Bot

### Mode Development:
```bash
npm run dev
# atau
node index.js
```

### Mode Production (dengan PM2):
```bash
# Install PM2
npm install -g pm2

# Jalankan bot
pm2 start index.js --name "yt-bot"

# Auto-restart jika VPS reboot
pm2 startup
pm2 save

# Monitor bot
pm2 logs yt-bot
pm2 status
```

---

## 📱 Cara Penggunaan Bot

```
1. Buka bot di Telegram
2. Kirim /start
3. Kirim /download
4. Masukkan judul lagu atau link YouTube
5. Pilih lagu dari hasil pencarian (jika search by judul)
6. Pilih format: MP3 atau MP4
7. Jika MP4, pilih kualitas: 360p / 720p / 1080p
8. Tunggu file dikirim
9. Lirik otomatis dikirim setelah file
```

---

## 🗂️ Struktur Project

```
yt-telegram-bot/
├── index.js              ← Entry point
├── handlers/
│   └── bot.js            ← Semua handler bot
├── services/
│   ├── youtube.js        ← Search & download YouTube
│   └── lyrics.js         ← Fetch lirik dari Genius
├── utils/
│   ├── queue.js          ← Manajemen antrian download
│   ├── state.js          ← State management per user
│   └── helpers.js        ← Fungsi utility umum
├── downloads/            ← Folder temporary (auto-dibuat)
├── cookies.txt           ← Export dari browser (buat sendiri!)
├── .env                  ← Konfigurasi (buat dari .env.example)
├── .env.example          ← Template konfigurasi
├── .gitignore
├── package.json
└── README.md
```

---

## ❗ Troubleshooting

### Bot error: "Sign in to confirm you're not a bot"
→ **Solusi:** Upload file `cookies.txt` dari browser yang sudah login YouTube

### Bot error: "HTTP Error 429"
→ **Solusi:** YouTube rate limiting. Tunggu beberapa menit, atau gunakan cookies

### File MP4 terlalu besar (>50MB)
→ **Solusi:** Pilih kualitas lebih rendah (360p) atau download MP3 saja

### ffmpeg not found
→ **Solusi:** `sudo apt install ffmpeg -y`

### yt-dlp outdated
→ **Solusi:** `yt-dlp -U` untuk update ke versi terbaru

### Lirik tidak ditemukan
→ **Solusi:** Pastikan `GENIUS_API_KEY` sudah diset di `.env`

---

## ⚖️ Disclaimer

Bot ini dibuat untuk keperluan pribadi dan edukasi. Hormati hak cipta konten yang didownload. Penggunaan untuk redistribusi komersial tidak dianjurkan.
