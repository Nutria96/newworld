const crypto = require("node:crypto");
const { json } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const auth = require("./_lib/adultAuth");
const storage = require("./_lib/privateStorage");

function admin(event) {
  const supplied = String(event.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = process.env.ADMIN_PASSWORD_HASH || "";
  if (!supplied || !expected) return false;
  const digest = crypto.createHash("sha256").update(supplied).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(expected.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async event => {
  if (!admin(event)) return json(401, { error: "Unauthorized" });
  if (event.httpMethod === "GET") {
    const profileUser = auth.safeId(event.queryStringParameters?.profileUser);
    if (profileUser) {
      const record = await auth.record(profileUser);
      if (!record?.profileObject) return json(404, { error: "Profile not found" });
      const profile = await storage.downloadDecrypted(record.profileObject);
      return json(200, { profile: JSON.parse(profile.toString("utf8")) });
    }
    const documentUser = auth.safeId(event.queryStringParameters?.documentUser);
    if (documentUser) {
      const record = await auth.record(documentUser);
      if (!record?.documentObject || !record.documentType) return json(404, { error: "Document not found" });
      const document = await storage.downloadDecrypted(record.documentObject);
      return {
        statusCode: 200,
        headers: {
          "content-type": record.documentType,
          "content-disposition": "inline",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        isBase64Encoded: true,
        body: document.toString("base64"),
      };
    }
    const selfieUser = auth.safeId(event.queryStringParameters?.selfieUser);
    if (selfieUser) {
      const record = await auth.record(selfieUser);
      if (!record?.selfieObject || !record.selfieType) return json(404, { error: "Selfie not found" });
      const selfie = await storage.downloadDecrypted(record.selfieObject);
      return {
        statusCode: 200,
        headers: {
          "content-type": record.selfieType,
          "content-disposition": "inline",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        isBase64Encoded: true,
        body: selfie.toString("base64"),
      };
    }
    const records = await firestore.listDocuments(auth.COLLECTION, 200);
    return json(200, {
      applications: records.map(item => ({
        userId: item.userId,
        status: item.status || "none",
        submittedAt: item.submittedAt || "",
        documentType: item.documentType || "",
        birthYear: item.birthYear || null,
        biometricEnrolled: Boolean(item.biometricEnrolled),
        voiceFactorUsed: Boolean(item.voiceFactorUsed),
      })),
    });
  }
  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const userId = auth.safeId(body.userId);
    if (!userId || !["approved", "rejected"].includes(body.status)) return json(400, { error: "Invalid decision" });
    await auth.save(userId, {
      status: body.status,
      reviewedAt: new Date().toISOString(),
      reviewNote: String(body.note || "").slice(0, 300),
    });
    return json(200, { updated: true });
  }
  return json(405, { error: "Method Not Allowed" });
};
