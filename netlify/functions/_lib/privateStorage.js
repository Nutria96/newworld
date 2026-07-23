const crypto = require("node:crypto");

let tokenCache = null;
let tokenExpiry = 0;

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function token() {
  if (tokenCache && Date.now() < tokenExpiry - 60_000) return tokenCache;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: process.env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/devstorage.read_write",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth2:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!response.ok) throw new Error("Storage authentication failed");
  const data = await response.json();
  tokenCache = data.access_token;
  tokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return tokenCache;
}

function key() {
  const value = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("IDENTITY_ENCRYPTION_KEY must be 32 bytes Base64");
  return value;
}

function encrypt(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(buffer) {
  if (buffer.length < 29) throw new Error("Invalid encrypted document");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
}

async function uploadEncrypted(name, buffer) {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("FIREBASE_STORAGE_BUCKET missing");
  const access = await token();
  const encrypted = encrypt(buffer);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${access}`, "content-type": "application/octet-stream" },
    body: encrypted,
  });
  if (!response.ok) throw new Error(`Private upload failed ${response.status}`);
  return { object: name, bytes: encrypted.length };
}

async function downloadDecrypted(name) {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket || !String(name).startsWith("restricted-identities/")) throw new Error("Invalid private object");
  const access = await token();
  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`,
    { headers: { authorization: `Bearer ${access}` } },
  );
  if (!response.ok) throw new Error(`Private download failed ${response.status}`);
  return decrypt(Buffer.from(await response.arrayBuffer()));
}

module.exports = { uploadEncrypted, downloadDecrypted };
