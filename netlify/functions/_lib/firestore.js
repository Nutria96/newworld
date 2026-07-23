const crypto = require("node:crypto");

let cachedToken = null;
let tokenExpiresAt = 0;

function configured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function safeUserId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,128}$/.test(id) ? id : null;
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function accessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Firebase auth ${response.status}`);
  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

function documentUrl(userId) {
  const project = encodeURIComponent(process.env.FIREBASE_PROJECT_ID);
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/chongseb_conversations/${encodeURIComponent(userId)}`;
}

function collectionUrl(collection, documentId = "") {
  const project = encodeURIComponent(process.env.FIREBASE_PROJECT_ID);
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${encodeURIComponent(collection)}`;
  return documentId ? `${base}/${encodeURIComponent(documentId)}` : base;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function decodeValue(value) {
  if (!value || "nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeValue);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [
        key,
        decodeValue(item),
      ]),
    );
  }
  return null;
}

function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encodeValue(value)]),
  );
}

function decodeDocument(document) {
  if (!document) return null;
  return {
    id: String(document.name || "").split("/").pop(),
    ...Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [
        key,
        decodeValue(value),
      ]),
    ),
  };
}

async function getDocument(collection, documentId) {
  if (!configured()) return null;
  const token = await accessToken();
  const response = await fetch(collectionUrl(collection, documentId), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read ${response.status}`);
  return decodeDocument(await response.json());
}

async function setDocument(collection, documentId, data) {
  if (!configured()) return null;
  const token = await accessToken();
  const response = await fetch(collectionUrl(collection, documentId), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!response.ok) throw new Error(`Firestore write ${response.status}`);
  return decodeDocument(await response.json());
}

async function createDocument(collection, documentId, data) {
  if (!configured()) return null;
  const token = await accessToken();
  const query = new URLSearchParams({ documentId });
  const response = await fetch(`${collectionUrl(collection)}?${query}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`Firestore create ${response.status}`);
  return decodeDocument(await response.json());
}

async function listDocuments(collection, pageSize = 300) {
  if (!configured()) return [];
  const token = await accessToken();
  const query = new URLSearchParams({
    pageSize: String(Math.max(1, Math.min(1000, pageSize))),
  });
  const response = await fetch(`${collectionUrl(collection)}?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Firestore list ${response.status}`);
  const data = await response.json();
  return (data.documents || []).map(decodeDocument);
}

function decodeMessage(value) {
  const fields = value?.mapValue?.fields || {};
  const role = fields.role?.stringValue;
  const content = fields.content?.stringValue;
  if (!["user", "assistant"].includes(role) || typeof content !== "string") return null;
  return { role, content: content.slice(0, 18000) };
}

async function getHistory(rawUserId) {
  if (!configured()) return [];
  const userId = safeUserId(rawUserId);
  if (!userId) return [];
  const token = await accessToken();
  const response = await fetch(documentUrl(userId), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Firestore read ${response.status}`);
  const document = await response.json();
  return (document.fields?.messages?.arrayValue?.values || [])
    .map(decodeMessage)
    .filter(Boolean)
    .slice(-20);
}

async function saveHistory(rawUserId, rawMessages) {
  if (!configured()) return false;
  const userId = safeUserId(rawUserId);
  if (!userId) return false;
  const messages = Array.isArray(rawMessages)
    ? rawMessages
        .filter(
          (item) =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string",
        )
        .slice(-20)
    : [];
  const token = await accessToken();
  const values = messages.map((item) => ({
    mapValue: {
      fields: {
        role: { stringValue: item.role },
        content: { stringValue: item.content.slice(0, 18000) },
      },
    },
  }));
  const response = await fetch(documentUrl(userId), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: userId },
        updatedAt: { timestampValue: new Date().toISOString() },
        messages: { arrayValue: { values } },
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore write ${response.status}`);
  return true;
}

module.exports = {
  configured,
  getHistory,
  saveHistory,
  getDocument,
  setDocument,
  createDocument,
  listDocuments,
};
