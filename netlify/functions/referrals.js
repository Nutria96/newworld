const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const { json, method } = require("./_lib/http");

const CODE = /^ch_[a-zA-Z0-9_-]{8,32}$/;
const USER = /^[a-zA-Z0-9_-]{16,128}$/;

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;
  if (!firestore.configured()) {
    return json(503, { error: "Firebase no configurado" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }
  const action = String(body.action || "");
  const code = String(body.code || "");
  const userId = String(body.userId || "");
  if (!CODE.test(code) || !USER.test(userId)) {
    return json(400, { error: "Referido inválido" });
  }

  try {
    if (action === "register") {
      const existing = await firestore.getDocument("chongseb_referrals", code);
      if (existing && existing.ownerUserId !== userId) {
        return json(409, { error: "Código no disponible" });
      }
      const referral =
        existing ||
        (await firestore.createDocument("chongseb_referrals", code, {
          ownerUserId: userId,
          visits: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      return json(200, {
        code,
        visits: Number(referral?.visits || 0),
        eligible: Number(referral?.visits || 0) >= 3,
      });
    }

    if (action === "visit") {
      const referral = await firestore.getDocument("chongseb_referrals", code);
      if (!referral) return json(404, { error: "Referido no encontrado" });
      if (referral.ownerUserId === userId) {
        return json(200, { counted: false, reason: "self" });
      }
      const visitId = hash(`${code}:${userId}`).slice(0, 48);
      const created = await firestore.createDocument(
        "chongseb_referral_visits",
        visitId,
        { code, visitorHash: hash(userId), createdAt: new Date() },
      );
      if (!created) return json(200, { counted: false, reason: "duplicate" });
      const visits = Number(referral.visits || 0) + 1;
      await firestore.setDocument("chongseb_referrals", code, {
        ownerUserId: referral.ownerUserId,
        visits,
        createdAt: referral.createdAt || new Date(),
        updatedAt: new Date(),
      });
      return json(200, { counted: true, visits, eligible: visits >= 3 });
    }

    if (action === "status") {
      const referral = await firestore.getDocument("chongseb_referrals", code);
      if (!referral || referral.ownerUserId !== userId) {
        return json(404, { error: "Referido no encontrado" });
      }
      const visits = Number(referral.visits || 0);
      return json(200, { code, visits, eligible: visits >= 3 });
    }
    return json(400, { error: "Acción inválida" });
  } catch {
    return json(502, { error: "No fue posible guardar el referido" });
  }
};
