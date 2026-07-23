const crypto = require("node:crypto");
const { Storage } = require("@google-cloud/storage");

const MAX_BYTES = Math.min(Number(process.env.MEDIA_MAX_FILE_BYTES) || 52_428_800, 52_428_800);
const MAX_FILES = Math.min(Number(process.env.MEDIA_MAX_FILES_PER_MESSAGE) || 5, 5);
const TTL_SECONDS = Math.max(60, Math.min(Number(process.env.MEDIA_SIGNED_URL_TTL_SECONDS) || 900, 3600));
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf", "text/plain", "text/csv", "application/json", "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const BLOCKED_EXTENSION = /\.(?:exe|msi|bat|cmd|com|scr|ps1|sh|js|mjs|cjs|html?|svg|php|jar|apk)$/i;

function enabled() {
  return String(process.env.MEDIA_UPLOADS_ENABLED).toLowerCase() === "true";
}

function storage() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("Firebase Storage configuration missing");
  }
  return new Storage({
    projectId: process.env.FIREBASE_PROJECT_ID,
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
  });
}

function bucket() {
  return storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
}

function cleanName(value) {
  const name = String(value || "archivo").normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(-120);
  return name || "archivo";
}

function validateFile(raw) {
  const name = cleanName(raw?.name);
  const type = String(raw?.type || "").toLowerCase();
  const size = Number(raw?.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) throw new Error("Invalid file size");
  if (!ALLOWED_TYPES.has(type) || BLOCKED_EXTENSION.test(name)) throw new Error("File type not allowed");
  return { name, type, size };
}

function kind(type) {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return "document";
}

function objectPath(scope, ownerId, chatId, attachmentId, name) {
  const safeScope = scope === "adult" ? "adult" : "main";
  const ownerHash = crypto.createHash("sha256").update(ownerId).digest("hex");
  const chatHash = crypto.createHash("sha256").update(String(chatId || "default")).digest("hex");
  return `chat-media/${safeScope}/${ownerHash}/${chatHash}/${attachmentId}/${cleanName(name)}`;
}

async function uploadUrl(path, type) {
  const [url] = await bucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + TTL_SECONDS * 1000,
    contentType: type,
  });
  return url;
}

async function readUrl(path) {
  const [url] = await bucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + TTL_SECONDS * 1000,
    responseDisposition: "inline",
  });
  return { url, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() };
}

module.exports = {
  MAX_BYTES, MAX_FILES, enabled, bucket, cleanName, validateFile, kind, objectPath, uploadUrl, readUrl,
};
