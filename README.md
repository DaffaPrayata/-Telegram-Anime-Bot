# 🎌 Telegram Anime Bot — Setup Guide

Bot Telegram untuk nonton anime via `ani-cli` dan `mpv` langsung dari laptop lo. Telegram jadi remote control.

---

## 📋 Daftar Isi

- [Setup di Linux](#setup-linux)
- [Setup di Windows](#setup-windows)
- [Install Bot](#install-bot)
- [Konfigurasi](#konfigurasi)
- [Cara Pakai](#cara-pakai)
- [Troubleshooting](#troubleshooting)

---

## 🐧 Setup Linux <a name="setup-linux"></a>

### 1. Install Dependencies

**Ubuntu / Debian / Linux Mint:**
```bash
sudo apt update
sudo apt install mpv curl git -y
```

**Arch / Manjaro:**
```bash
sudo pacman -S mpv curl git
```

**Fedora:**
```bash
sudo dnf install mpv curl git -y
```

### 2. Install ani-cli

```bash
# Download langsung dari GitHub
sudo curl -fsSL https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli \
  -o /usr/local/bin/ani-cli

# Kasih permission execute
sudo chmod +x /usr/local/bin/ani-cli
```

**Verifikasi:**
```bash
ani-cli --version
# Output: ani-cli 4.x.x
```

### 3. Install Node.js

```bash
# Pakai NodeSource (lebih up to date dari apt)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Verifikasi
node --version   # harus v18+
npm --version
```

---

## 🪟 Setup Windows <a name="setup-windows"></a>

> ⚠️ ani-cli adalah bash script — tidak bisa jalan langsung di Windows.
> Lo butuh **WSL2** (Windows Subsystem for Linux).

### 1. Aktifkan WSL2

Buka **PowerShell sebagai Administrator**, jalankan:
```powershell
wsl --install
```

Restart komputer. Setelah restart, Windows bakal install Ubuntu secara otomatis.

Buka **Ubuntu** dari Start Menu, buat username dan password.

### 2. Install Dependencies di WSL2

Di terminal Ubuntu (WSL2):
```bash
sudo apt update
sudo apt install mpv curl git -y
```

### 3. Install ani-cli di WSL2

```bash
sudo curl -fsSL https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli \
  -o /usr/local/bin/ani-cli
sudo chmod +x /usr/local/bin/ani-cli
```

### 4. Install Node.js di WSL2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

### 5. Setup Display untuk MPV (Windows)

MPV butuh bisa nampilin window. Di WSL2, lo perlu **WSLg** (sudah built-in di Windows 11) atau **VcXsrv** di Windows 10.

**Windows 11:** Langsung works, tidak perlu setup tambahan.

**Windows 10:**
1. Download dan install [VcXsrv](https://sourceforge.net/projects/vcxsrv/)
2. Jalankan XLaunch → pilih "Multiple windows" → Next → Next → centang "Disable access control" → Finish
3. Di terminal WSL2, tambahkan:
```bash
echo 'export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk "{print \$2}"):0' >> ~/.bashrc
source ~/.bashrc
```

**Verifikasi MPV:**
```bash
mpv --version
```

> 💡 Semua perintah selanjutnya dijalankan di terminal WSL2, bukan PowerShell.

---

## 🤖 Buat Telegram Bot <a name="konfigurasi"></a>

### 1. Buat Bot via BotFather

1. Buka Telegram, cari `@BotFather`
2. Kirim `/newbot`
3. Ikuti instruksi — kasih nama dan username (harus diakhiri `bot`)
4. Copy **token** yang diberikan. Format: `7412345678:AAHxxx...`

### 2. Dapat User ID Lo

1. Cari `@userinfobot` di Telegram
2. Kirim sembarang pesan
3. Copy angka di bagian `Id:` — itu **OWNER_ID** lo

---

## 📦 Install Bot <a name="install-bot"></a>

### 1. Clone / Copy File Bot

Taruh semua file bot di satu folder:
```
bot/
├── index.js
├── player.js
├── stateManager.js
├── config.js
├── package.json
└── .env
```

### 2. Install Node Modules

```bash
cd bot
npm install
```

### 3. Buat File .env

```bash
cp .env.example .env
nano .env
```

Isi dengan data lo:
```env
BOT_TOKEN=7412345678:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OWNER_ID=123456789
```

Simpan: `Ctrl+O` → Enter → `Ctrl+X`

### 4. Jalankan Bot

```bash
npm start
```

Output yang benar:
```
[OK] Dependencies OK.
[BOT] Started.
```

---

## 🎮 Cara Pakai <a name="cara-pakai"></a>

Buka Telegram, chat dengan bot lo.

| Perintah | Fungsi |
|---|---|
| `/nonton one piece` | Cari anime, pilih dari list |
| `/nonton one piece 1100` | Langsung ke episode 1100 |
| `/stop` | Stop playback |
| `/status` | Cek sedang putar apa |
| `/help` | Bantuan |

### Flow Normal

```
/nonton attack on titan
  → Bot tampilkan list judul
  → Tap judul yang mau ditonton
  → Bot tampilkan list episode
  → Tap episode
  → Bot tanya resolusi (360p / 480p / 720p / 1080p)
  → MPV kebuka di laptop lo
```

### Flow Cepat (Langsung Episode)

```
/nonton one piece 1100
  → Bot cari "one piece"
  → Pilih judul dari list
  → Langsung tanya resolusi (skip pilih episode)
  → MPV kebuka
```

---

## 🔧 Troubleshooting <a name="troubleshooting"></a>

**`ani-cli: command not found`**
```bash
sudo curl -fsSL https://raw.githubusercontent.com/pystardust/ani-cli/master/ani-cli \
  -o /usr/local/bin/ani-cli && sudo chmod +x /usr/local/bin/ani-cli
```

**`mpv: command not found`**
```bash
sudo apt install mpv -y
```

**Bot tidak merespons**
- Pastikan `BOT_TOKEN` dan `OWNER_ID` di `.env` sudah benar
- Cek OWNER_ID lo dengan chat ke `@userinfobot`
- Restart bot: `Ctrl+C` lalu `npm start` lagi

**"Anime tidak ditemukan"**
- Coba judul yang lebih spesifik atau bahasa Inggris
- Cek koneksi internet lo

**MPV tidak muncul (Windows)**
- Pastikan VcXsrv jalan (Windows 10) atau update Windows 11
- Cek `DISPLAY` sudah di-set di WSL2

**Bot jalan tapi MPV tidak kebuka**
```bash
# Test manual dulu
ani-cli "one piece" -e 1 -q 480
```
Kalau ini works tapi bot tidak, paste error di terminal bot.

---

## 🔄 Jalankan Bot Otomatis Saat Startup (Linux)

Kalau mau bot otomatis jalan tanpa perlu `npm start` manual:

```bash
# Install pm2
sudo npm install -g pm2

# Jalankan bot via pm2
cd ~/Downloads/project/bot
pm2 start index.js --name anime-bot

# Set autostart
pm2 startup
pm2 save
```

Perintah pm2:
```bash
pm2 status          # cek status
pm2 logs anime-bot  # lihat log
pm2 restart anime-bot
pm2 stop anime-bot
```# -Telegram-Anime-Bot
# -Telegram-Anime-Bot
