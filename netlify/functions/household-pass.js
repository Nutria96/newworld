const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const household = require("./_lib/householdAccess");
const { json } = require("./_lib/http");

exports.handler = async event => {
  try {
    if (event.httpMethod === "GET") {
      return json(200, { active: await household.active(event) });
    }
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    const body = JSON.parse(event.body || "{}");
    if (body.action === "logout") {
      return {
        ...json(200, { active: false }),
        multiValueHeaders: { "Set-Cookie": [household.clearCookie()] },
      };
    }
    const code = String(body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{16,32}$/.test(code)) return json(400, { error: "Código inválido" });
    const record = await firestore.getDocument(household.COLLECTION, household.DOCUMENT);
    const supplied = Buffer.from(household.codeHash(code), "hex");
    const expected = Buffer.from(String(record?.codeHash || ""), "hex");
    const validHash =
      supplied.length === expected.length &&
      supplied.length > 0 &&
      crypto.timingSafeEqual(supplied, expected);
    if (
      !record?.active ||
      !validHash ||
      Date.parse(record.codeExpiresAt || "") <= Date.now() ||
      Number(record.uses || 0) >= Number(record.maxUses || 0)
    ) {
      return json(403, { error: "Código vencido, revocado o sin usos disponibles" });
    }
    await firestore.setDocument(household.COLLECTION, household.DOCUMENT, {
      ...record,
      uses: Number(record.uses || 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    return {
      ...json(200, { active: true }),
      multiValueHeaders: { "Set-Cookie": [household.cookie(record.generation)] },
    };
  } catch (error) {
    console.error("household-pass", error.message);
    return json(500, { error: "Pase Hogar no disponible" });
  }
};
