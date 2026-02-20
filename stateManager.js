// stateManager.js

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit

export const session = new Map();

/**
 * Ambil session user.
 */
export function getSession(userId) {
  return session.get(userId) ?? null;
}

/**
 * Reset session user ke idle dan clear timer.
 */
export function resetSession(userId) {
  const sess = session.get(userId);
  if (sess?.timer) clearTimeout(sess.timer);
  session.delete(userId);
}

/**
 * Set state baru dengan auto-timeout.
 * Kalau timeout → hapus session otomatis.
 */
export function setSessionState(userId, state, data = {}) {
  const existing = session.get(userId);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    session.delete(userId);
    console.log(`[STATE] Session ${userId} expired.`);
  }, SESSION_TIMEOUT_MS);

  session.set(userId, {
    state,
    lock: false,
    timer,
    ...data,
  });
}