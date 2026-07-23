const sessions = new Map();
const WINDOW_MS = 60 * 60_000;
const MAX_REQUESTS = 40;

function checarLimite(rawSession) {
  const session = String(rawSession || "anon").slice(0, 128);
  const now = Date.now();
  const current = sessions.get(session);
  const state =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  state.count += 1;
  sessions.set(session, state);
  return {
    permitido: state.count <= MAX_REQUESTS,
    restantes: Math.max(0, MAX_REQUESTS - state.count),
    reiniciaEn: new Date(state.resetAt).toISOString(),
  };
}

module.exports = { checarLimite };
