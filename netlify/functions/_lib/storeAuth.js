const crypto = require("node:crypto");

const COOKIE = "chongseb_store_session";

function safeId(value) {
  const id = String(value || "");
  return /^[a-zA-Z0-9_-]{16,128}$/.test(id) ? id : null;
}

function secret() {
  const value = process.env.JWT_SECRET || process.env.ADULT_SESSION_SECRET;
  if (!value) throw new Error("JWT_SECRET missing");
  return value;
}

function sign(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsigned = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", secret()).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verify(value) {
  try {
    const [header, body, signature] = String(value || "").split(".");
    const unsigned = `${header}.${body}`;
    const expected = crypto.createHmac("sha256", secret()).update(unsigned).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.scope === "store" && payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

function session(event) {
  const cookies = Object.fromEntries(
    String(event.headers?.cookie || "").split(";").map(item => item.trim().split("=")).filter(parts => parts.length === 2),
  );
  return verify(cookies[COOKIE]);
}

function cookie(userId) {
  const token = sign({ sub: userId, scope: "store", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7776000`;
}

module.exports = { safeId, session, cookie };
