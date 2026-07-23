const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const household = require("./_lib/householdAccess");
const { json } = require("./_lib/http");

function authorized(event) {
  const expected = String(process.env.ADMIN_PASSWORD_HASH || "").toLowerCase();
  const token = String(event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!/^[a-f0-9]{64}$/.test(expected) || !token) return false;
  const actual = crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

exports.handler = async event => {
  if (!authorized(event)) return json(401, { error: "No autorizado" });
  if (!firestore.configured()) return json(503, { error: "Firebase no configurado" });
  try {
    const current = await firestore.getDocument(household.COLLECTION, household.DOCUMENT);
    if (event.httpMethod === "GET") {
      return json(200, {
        active: Boolean(current?.active),
        uses: Number(current?.uses || 0),
        maxUses: Number(current?.maxUses || 0),
        codeExpiresAt: current?.codeExpiresAt || null,
        updatedAt: current?.updatedAt || null,
      });
    }
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    const body = JSON.parse(event.body || "{}");
    if (body.action === "revoke") {
      await firestore.setDocument(household.COLLECTION, household.DOCUMENT, {
        active: false,
        generation: crypto.randomUUID(),
        uses: 0,
        maxUses: 0,
        codeHash: "",
        codeExpiresAt: "",
        updatedAt: new Date().toISOString(),
      });
      return json(200, { revoked: true });
    }
    if (body.action !== "issue") return json(400, { error: "Acción inválida" });
    const code = crypto.randomBytes(12).toString("base64url").toUpperCase();
    const generation = crypto.randomUUID();
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await firestore.setDocument(household.COLLECTION, household.DOCUMENT, {
      active: true,
      generation,
      codeHash: household.codeHash(code),
      codeExpiresAt,
      uses: 0,
      maxUses: 10,
      updatedAt: new Date().toISOString(),
    });
    return json(201, { code, codeExpiresAt, maxUses: 10 });
  } catch (error) {
    console.error("admin-household-pass", error.message);
    return json(500, { error: "No se pudo gestionar el Pase Hogar" });
  }
};
