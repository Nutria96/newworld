const crypto = require("node:crypto");
const firestore = require("./firestore");

const COLLECTION = "chongseb_adult_access";
const COOKIE = "chongseb_adult_session";

function safeId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,128}$/.test(id) ? id : null;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  const secret = process.env.JWT_SECRET || process.env.ADULT_SESSION_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encoded = base64url(JSON.stringify(payload));
  const unsigned = `${header}.${encoded}`;
  const signature = crypto.createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verify(token) {
  try {
    const [header, encoded, signature] = String(token || "").split(".");
    const secret = process.env.JWT_SECRET || process.env.ADULT_SESSION_SECRET || "";
    const unsigned = `${header}.${encoded}`;
    const expected = crypto.createHmac("sha256", secret).update(unsigned).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookies(event) {
  return Object.fromEntries(
    String(event.headers?.cookie || "").split(";").map(item => item.trim().split("=")).filter(parts => parts.length === 2),
  );
}

function session(event) {
  return verify(cookies(event)[COOKIE]);
}

function sessionCookie(userId) {
  const token = sign({ sub: userId, scope: "adult", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function record(userId) {
  const id = safeId(userId);
  return id ? firestore.getDocument(COLLECTION, id) : null;
}

async function save(userId, data) {
  const id = safeId(userId);
  if (!id) throw new Error("Invalid user id");
  const previous = (await record(id)) || {};
  return firestore.setDocument(COLLECTION, id, { ...previous, ...data, userId: id, updatedAt: new Date().toISOString() });
}

module.exports = { COLLECTION, safeId, session, sessionCookie, clearCookie, record, save };
