// player.js
import { spawn, execSync } from "child_process";

let _playing = false;
let _currentProcess = null;

const ALLANIME_API = "https://api.allanime.day/api";
const ALLANIME_REFERER = "https://allanime.to";
const USER_AGENT = "Mozilla/5.0";

const SEARCH_GQL = `query($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name } } }`;
const EPISODES_GQL = `query($showId: String!) { show(_id: $showId) { availableEpisodesDetail } }`;

async function allanimeRequest(variables, query) {
  const params = new URLSearchParams();
  params.append("variables", JSON.stringify(variables));
  params.append("query", query);

  const res = await fetch(`${ALLANIME_API}?${params.toString()}`, {
    headers: { "Referer": ALLANIME_REFERER, "User-Agent": USER_AGENT },
  });
  return res.json();
}

export function isPlaying() {
  return _playing;
}

/**
 * Search anime — return list judul + id
 */
export async function searchAnime(query) {
  try {
    const json = await allanimeRequest({
      search: { allowAdult: false, allowUnknown: false, query },
      limit: 10, page: 1, translationType: "sub", countryOrigin: "ALL",
    }, SEARCH_GQL);

    const edges = json?.data?.shows?.edges;
    if (!edges || edges.length === 0) return { success: false, error: "Anime tidak ditemukan." };

    return {
      success: true,
      results: edges.map((e, i) => ({ index: i + 1, id: e._id, title: e.name })),
    };
  } catch (err) {
    console.error("[SEARCH] Error:", err.message);
    return { success: false, error: "Gagal koneksi ke API." };
  }
}

/**
 * Get episode list dari show ID
 */
export async function getEpisodes(showId) {
  try {
    const json = await allanimeRequest({ showId }, EPISODES_GQL);
    const detail = json?.data?.show?.availableEpisodesDetail;
    if (!detail) return { success: false, error: "Gagal ambil episode." };

    // Pakai sub, fallback ke dub atau raw
    const eps = detail.sub?.length ? detail.sub
              : detail.dub?.length ? detail.dub
              : detail.raw;

    if (!eps || eps.length === 0) return { success: false, error: "Tidak ada episode tersedia." };

    // Sort ascending
    const sorted = [...eps].sort((a, b) => parseFloat(a) - parseFloat(b));
    return { success: true, episodes: sorted };
  } catch (err) {
    console.error("[EPISODES] Error:", err.message);
    return { success: false, error: "Gagal koneksi ke API." };
  }
}

/**
 * Spawn ani-cli untuk playback
 */
export function startPlayback(title, episode, resolution) {
  return new Promise((resolve) => {
    if (_playing) {
      resolve({ success: false, error: "Sudah ada playback aktif." });
      return;
    }

    console.log(`[PLAYER] Spawning: ani-cli "${title}" -e ${episode} -q ${resolution}`);

    const child = spawn("ani-cli", [title, "-e", episode, "-q", resolution], {
      stdio: "inherit",
      detached: false,
    });

    _playing = true;
    _currentProcess = child;

    child.on("error", (err) => {
      console.error("[PLAYER] Error:", err.message);
      _playing = false;
      _currentProcess = null;
      resolve({ success: false, error: err.message });
    });

    child.on("close", (code) => {
      console.log(`[PLAYER] ani-cli exited: ${code}`);
      _playing = false;
      _currentProcess = null;
      resolve(code === 0 || code === null
        ? { success: true }
        : { success: false, error: `ani-cli exit code: ${code}` }
      );
    });
  });
}

/**
 * Stop semua playback
 */
export function stopPlayback() {
  if (_currentProcess) {
    try { _currentProcess.kill("SIGTERM"); } catch {}
    _currentProcess = null;
  }
  try {
    execSync("pkill -f mpv", { stdio: "ignore" });
    console.log("[PLAYER] mpv killed.");
  } catch {}
  _playing = false;
}