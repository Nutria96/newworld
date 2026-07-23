const crypto = require("node:crypto");
const firestore = require("./firestore");

const COOKIE = "chongseb_household";
const COLLECTION = "chongseb_household_access";
const DOCUMENT = "current";

function secret() {
  const value = process.env.HOUSEHOLD_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("HOUSEHOLD_ACCESS_SECRET missing");
  return value;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token) {
  try {
    const [body, signature] = String(token || "").split(".");
    const expected = crypto.createHmac("sha256", secret()).update(body).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.scope === "household" && payload.exp > Date.now() / 1000 ? payload : null;
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

async function active(event) {
  const payload = verify(cookies(event)[COOKIE]);
  if (!payload) return false;
  const record = await firestore.getDocument(COLLECTION, DOCUMENT);
  return Boolean(
    record?.active &&
    record.generation === payload.generation &&
    payload.exp > Date.now() / 1000,
  );
}

function cookie(generation) {
  const maxAge = 30 * 24 * 60 * 60;
  const token = sign({
    scope: "household",
    generation,
    device: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + maxAge,
  });
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function codeHash(code) {
  return crypto.createHash("sha256").update(String(code).trim().toUpperCase()).digest("hex");
}

module.exports = {
  COLLECTION,
  DOCUMENT,
  active,
  cookie,
  clearCookie,
  codeHash,
};
