import { Telegraf } from "telegraf";
import { execSync } from "child_process";
import config from "./config.js";
import { resetSession, getSession, session } from "./stateManager.js";
import { searchAnime, getEpisodes, startPlayback, stopPlayback, isPlaying } from "./player.js";

function checkDeps() {
  for (const dep of ["ani-cli", "mpv", "pkill"]) {
    try { execSync(`which ${dep}`, { stdio: "ignore" }); }
    catch { console.error(`[FATAL] Missing: ${dep}`); process.exit(1); }
  }
  console.log("[OK] Dependencies OK.");
}

function cleanupOrphan() {
  try { execSync("pkill -f mpv", { stdio: "ignore" }); } catch {}
}

checkDeps();
cleanupOrphan();

const bot = new Telegraf(config.BOT_TOKEN);

bot.use((ctx, next) => {
  if (ctx.from?.id !== config.OWNER_ID) return;
  return next();
});

bot.command("start", (ctx) => ctx.reply(
  "🎌 Anime bot aktif.\n\n" +
  "/nonton <judul> — cari & tonton\n" +
  "/stop           — stop playback\n" +
  "/status         — status sekarang"
));

bot.command("help", (ctx) => ctx.reply(
  "Contoh: /nonton attack on titan\n\n" +
  "Bot nampilin list judul → pilih → pilih episode → pilih resolusi → mpv kebuka."
));

bot.command("status", (ctx) => {
  const sess = getSession(config.OWNER_ID);
  if (isPlaying()) return ctx.reply(`▶️ Sedang memutar: ${sess?.chosenTitle || "?"} ep ${sess?.chosenEpisode || "?"}`);
  ctx.reply("⏹️ Tidak ada yang diputar.");
});

// ── /nonton ───────────────────────────────────────────────────────────────────
bot.command("nonton", async (ctx) => {
  if (isPlaying()) return ctx.reply("⚠️ Masih ada yang diputar. /stop dulu.");

  const raw = ctx.message.text.replace(/^\/nonton\s*/i, "").replace(/[<>]/g, "").trim();
  if (!raw) return ctx.reply("❓ Contoh: /nonton attack on titan\nAtau: /nonton one piece 1100");

  // Cek apakah ada nomor episode di akhir: "/nonton one piece 1100"
  const epMatch = raw.match(/^(.+?)\s+(\d{1,4})$/);
  const query = epMatch ? epMatch[1].trim() : raw;
  const directEpisode = epMatch ? epMatch[2] : null;

  session.set(config.OWNER_ID, { state: "searching", title: query });
  const msg = await ctx.reply(`🔍 Mencari *${query}*...`, { parse_mode: "Markdown" });

  const result = await searchAnime(query);
  if (!result.success) {
    resetSession(config.OWNER_ID);
    return ctx.telegram.editMessageText(config.OWNER_ID, msg.message_id, null, `❌ ${result.error}`);
  }

  // Kalau ada episode langsung dan hanya 1 hasil → skip title & episode selection
  if (directEpisode && result.results.length === 1) {
    const chosen = result.results[0];
    session.set(config.OWNER_ID, {
      state: "choosing_resolution",
      title: query,
      results: result.results,
      chosenId: chosen.id,
      chosenTitle: chosen.title,
      chosenEpisode: directEpisode,
    });
    return ctx.telegram.editMessageText(
      config.OWNER_ID, msg.message_id, null,
      `✅ *${chosen.title}* — Episode ${directEpisode}\n\nPilih resolusi:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "360p", callback_data: "res:360" }, { text: "480p ⚡", callback_data: "res:480" }],
            [{ text: "720p", callback_data: "res:720" }, { text: "1080p", callback_data: "res:1080" }],
            [{ text: "❌ Batal", callback_data: "res:cancel" }],
          ],
        },
      }
    );
  }

  session.set(config.OWNER_ID, {
    state: "choosing_title",
    title: query,
    results: result.results,
    directEpisode,  // simpan kalau ada, untuk dipakai setelah pilih judul
  });

  const keyboard = result.results.slice(0, 10).map((r) => [{
    text: `${r.index}. ${r.title}`,
    callback_data: `pick:${r.index}`,
  }]);
  keyboard.push([{ text: "❌ Batal", callback_data: "pick:cancel" }]);

  await ctx.telegram.editMessageText(
    config.OWNER_ID, msg.message_id, null,
    `🎌 Hasil untuk *${query}*:\n\nPilih yang mau ditonton:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }
  );
});

// ── Callback handler ──────────────────────────────────────────────────────────
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const sess = getSession(config.OWNER_ID);
  await ctx.answerCbQuery();

  // ── Step 1: Pilih judul ──
  if (data.startsWith("pick:")) {
    if (sess?.state !== "choosing_title") return;

    if (data === "pick:cancel") {
      resetSession(config.OWNER_ID);
      return ctx.editMessageText("❌ Dibatalkan.");
    }

    const index = parseInt(data.replace("pick:", ""));
    const chosen = sess.results?.find((r) => r.index === index);
    if (!chosen) return;

    // Kalau ada directEpisode dari command → skip episode selection
    if (sess.directEpisode) {
      session.set(config.OWNER_ID, {
        ...sess,
        state: "choosing_resolution",
        chosenId: chosen.id,
        chosenTitle: chosen.title,
        chosenEpisode: sess.directEpisode,
      });
      return ctx.editMessageText(
        `✅ *${chosen.title}* — Episode ${sess.directEpisode}\n\nPilih resolusi:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "360p", callback_data: "res:360" }, { text: "480p ⚡", callback_data: "res:480" }],
              [{ text: "720p", callback_data: "res:720" }, { text: "1080p", callback_data: "res:1080" }],
              [{ text: "❌ Batal", callback_data: "res:cancel" }],
            ],
          },
        }
      );
    }

    await ctx.editMessageText(`⏳ Mengambil episode *${chosen.title}*...`, { parse_mode: "Markdown" });

    const epResult = await getEpisodes(chosen.id);
    if (!epResult.success) {
      resetSession(config.OWNER_ID);
      return ctx.editMessageText(`❌ ${epResult.error}`);
    }

    session.set(config.OWNER_ID, {
      ...sess,
      state: "choosing_episode",
      chosenId: chosen.id,
      chosenTitle: chosen.title,
      episodes: epResult.episodes,
      epPage: 0,
    });

    await sendEpisodePage(ctx, epResult.episodes, 0, chosen.title);
    return;
  }

  // ── Navigasi halaman episode ──
  if (data.startsWith("eppage:")) {
    if (sess?.state !== "choosing_episode") return;
    const page = parseInt(data.replace("eppage:", ""));
    session.set(config.OWNER_ID, { ...sess, epPage: page });
    await sendEpisodePage(ctx, sess.episodes, page, sess.chosenTitle, true);
    return;
  }

  // ── Step 2: Pilih episode ──
  if (data.startsWith("ep:")) {
    if (sess?.state !== "choosing_episode") return;

    const episode = data.replace("ep:", "");

    session.set(config.OWNER_ID, {
      ...sess,
      state: "choosing_resolution",
      chosenEpisode: episode,
    });

    await ctx.editMessageText(
      `✅ *${sess.chosenTitle}* — Episode ${episode}\n\nPilih resolusi:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "360p", callback_data: "res:360" },
              { text: "480p ⚡", callback_data: "res:480" },
            ],
            [
              { text: "720p", callback_data: "res:720" },
              { text: "1080p", callback_data: "res:1080" },
            ],
            [{ text: "❌ Batal", callback_data: "res:cancel" }],
          ],
        },
      }
    );
    return;
  }

  // ── Step 3: Pilih resolusi ──
  if (data.startsWith("res:")) {
    if (sess?.state !== "choosing_resolution") return;

    if (data === "res:cancel") {
      stopPlayback();
      resetSession(config.OWNER_ID);
      return ctx.editMessageText("❌ Dibatalkan.");
    }

    const resolution = data.replace("res:", "");
    session.set(config.OWNER_ID, { ...sess, state: "executing", resolution });

    await ctx.editMessageText(
      `⏳ Memulai *${sess.chosenTitle}* ep ${sess.chosenEpisode} (${resolution}p)...`,
      { parse_mode: "Markdown" }
    );

    const result = await startPlayback(sess.chosenTitle, sess.chosenEpisode, resolution);
    resetSession(config.OWNER_ID);

    if (result.success) {
      await ctx.telegram.sendMessage(config.OWNER_ID, `✅ Selesai memutar.`);
    } else {
      await ctx.telegram.sendMessage(config.OWNER_ID, `❌ Error: ${result.error}`);
    }
  }
});

// ── Helper: kirim/edit halaman episode ───────────────────────────────────────
async function sendEpisodePage(ctx, episodes, page, title, edit = false) {
  const PAGE_SIZE = 10;
  const start = page * PAGE_SIZE;
  const slice = episodes.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(episodes.length / PAGE_SIZE);

  // Episode buttons — 2 per baris
  const epRows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const row = [{ text: `Ep ${slice[i]}`, callback_data: `ep:${slice[i]}` }];
    if (slice[i + 1]) row.push({ text: `Ep ${slice[i + 1]}`, callback_data: `ep:${slice[i + 1]}` });
    epRows.push(row);
  }

  // Navigasi
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: `eppage:${page - 1}` });
  if (page < totalPages - 1) nav.push({ text: "Next ▶️", callback_data: `eppage:${page + 1}` });
  if (nav.length) epRows.push(nav);
  epRows.push([{ text: "❌ Batal", callback_data: "pick:cancel" }]);

  const text = `📺 *${title}*\n\nPilih episode: (${episodes.length} total)`;

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: epRows },
    });
  } else {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: epRows },
    });
  }
}

// ── /stop ─────────────────────────────────────────────────────────────────────
bot.command("stop", (ctx) => {
  if (!isPlaying()) return ctx.reply("⏹️ Tidak ada yang diputar.");
  stopPlayback();
  resetSession(config.OWNER_ID);
  ctx.reply("⏹️ Dihentikan.");
});

bot.on("text", (ctx) => {
  const sess = getSession(config.OWNER_ID);
  if (["choosing_title", "choosing_episode", "choosing_resolution"].includes(sess?.state)) {
    ctx.reply("👆 Gunakan tombol di atas.");
  }
});

bot.launch({ allowedUpdates: ["message", "callback_query"] });
console.log("[BOT] Started.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));