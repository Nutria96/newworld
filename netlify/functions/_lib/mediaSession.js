const crypto = require("node:crypto");

const COOKIE = "chongseb_media_session";

function secret() {
  const value = process.env.MEDIA_SESSION_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("MEDIA_SESSION_SECRET missing");
  return value;
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token) {
  try {
    const [encoded, signature] = String(token || "").split(".");
    const expected = crypto.createHmac("sha256", secret()).update(encoded).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.scope !== "media" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookies(event) {
  return Object.fromEntries(
    String(event.headers?.cookie || "")
      .split(";")
      .map(item => item.trim().split("="))
      .filter(parts => parts.length === 2),
  );
}

function session(event) {
  return verify(cookies(event)[COOKIE]);
}

function create() {
  return {
    sub: crypto.randomUUID().replaceAll("-", ""),
    scope: "media",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
}

function cookie(payload) {
  return `${COOKIE}=${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

module.exports = { session, create, cookie };
