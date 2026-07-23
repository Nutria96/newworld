const firestore = require("./firestore");

const COLLECTION = "chongseb_configuration";
const DOCUMENT = "adult_promo";
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

async function state() {
  const record = await firestore.getDocument(COLLECTION, DOCUMENT);
  const expiresAt = record?.expiresAt ? Date.parse(record.expiresAt) : 0;
  const active = Boolean(record?.active && expiresAt > Date.now());
  return {
    active,
    startedAt: record?.startedAt || null,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    updatedAt: record?.updatedAt || null,
  };
}

async function activate() {
  const now = new Date();
  const data = {
    active: true,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MAX_DURATION_MS).toISOString(),
    updatedAt: now.toISOString(),
  };
  await firestore.setDocument(COLLECTION, DOCUMENT, data);
  return data;
}

async function deactivate() {
  const data = {
    active: false,
    startedAt: null,
    expiresAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await firestore.setDocument(COLLECTION, DOCUMENT, data);
  return data;
}

module.exports = { state, activate, deactivate };
