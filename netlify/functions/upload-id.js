const crypto = require("node:crypto");
const { json, method } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const storage = require("./_lib/privateStorage");
const firestore = require("./_lib/firestore");
const bcrypt = require("bcryptjs");

const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);

function age(dateValue) {
  const born = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(born.getTime()) || born > new Date()) return -1;
  const now = new Date();
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const month = now.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) years -= 1;
  return years;
}

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const userId = auth.safeId(body.userId);
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const type = String(body.type || "");
    const years = age(body.birthDate);
    if (
      !userId ||
      !/^[a-zA-Z0-9_.-]{3,30}$/.test(username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      !allowed.has(type) ||
      years < 18
    ) {
      return json(400, {
        error:
          years >= 0 && years < 18
            ? "Esta sección es solo para mayores de edad. Vuelve cuando tengas 18."
            : "Valid adult identity data required",
      });
    }
    const match = String(body.document || "").match(/^data:[^;]+;base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) return json(400, { error: "Invalid document" });
    const buffer = Buffer.from(match[1], "base64");
    if (!buffer.length || buffer.length > 3 * 1024 * 1024) return json(413, { error: "Document must be 3 MB or less" });
    const selfieMatch = String(body.selfie || "").match(/^data:(image\/(?:jpeg|png));base64,([a-zA-Z0-9+/=]+)$/);
    if (!selfieMatch) return json(400, { error: "Valid selfie required" });
    const selfieBuffer = Buffer.from(selfieMatch[2], "base64");
    if (!selfieBuffer.length || selfieBuffer.length > 3 * 1024 * 1024) return json(413, { error: "Selfie must be 3 MB or less" });

    const usernameId = crypto
      .createHash("sha256")
      .update(username.toLowerCase())
      .digest("hex");
    const existingName = await firestore.getDocument(
      "chongseb_adult_usernames",
      usernameId,
    );
    if (existingName && existingName.userId !== userId) {
      return json(409, { error: "Username is already in use" });
    }
    if (!existingName) {
      const reserved = await firestore.createDocument(
        "chongseb_adult_usernames",
        usernameId,
        { userId, createdAt: new Date().toISOString() },
      );
      if (!reserved) return json(409, { error: "Username is already in use" });
    }

    const objectName = `restricted-identities/${userId}/${crypto.randomUUID()}.enc`;
    const profileName = `restricted-identities/${userId}/profile-${crypto.randomUUID()}.enc`;
    const selfieName = `restricted-identities/${userId}/selfie-${crypto.randomUUID()}.enc`;
    const uploaded = await storage.uploadEncrypted(objectName, buffer);
    await storage.uploadEncrypted(selfieName, selfieBuffer);
    await storage.uploadEncrypted(
      profileName,
      Buffer.from(
        JSON.stringify({
          username,
          email,
          birthDate: body.birthDate,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    await auth.save(userId, {
      status: "pending",
      documentObject: uploaded.object,
      documentType: type,
      profileObject: profileName,
      selfieObject: selfieName,
      selfieType: selfieMatch[1],
      passwordHash: await bcrypt.hash(password, 12),
      usernameHash: usernameId,
      emailHash: crypto.createHash("sha256").update(email).digest("hex"),
      birthYear: new Date(`${body.birthDate}T00:00:00Z`).getUTCFullYear(),
      ageVerifiedClientInput: true,
      voiceFactorUsed: Boolean(body.voiceVerified),
      submittedAt: new Date().toISOString(),
      privacyConsentAt: new Date().toISOString(),
    });
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `🔐 Nueva solicitud de acceso adulto CHONGSEB\nID: ${userId}\nRevisar en /admin`,
        }),
      }).catch(() => {});
    }
    return json(202, { status: "pending", message: "Identity submitted for manual review" });
  } catch (error) {
    console.error("upload-id", error.message);
    return json(500, { error: "Secure identity upload failed" });
  }
};
