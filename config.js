// config.js
// Load from environment variables (.env via dotenv or shell export)

import "dotenv/config";

const config = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: parseInt(process.env.OWNER_ID, 10),
};

// Validate on load
if (!config.BOT_TOKEN) {
  console.error("[FATAL] BOT_TOKEN tidak ditemukan di environment.");
  process.exit(1);
}

if (!config.OWNER_ID || isNaN(config.OWNER_ID)) {
  console.error("[FATAL] OWNER_ID tidak valid. Isi dengan Telegram user ID lo.");
  process.exit(1);
}

export default config;