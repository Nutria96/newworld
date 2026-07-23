const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const { json, method } = require("./_lib/http");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  const email = String(body.email || "").trim().toLowerCase();
  const consent = body.consent === true;
  if (!EMAIL.test(email) || email.length > 254 || !consent) {
    return json(400, { error: "Correo o consentimiento inválido" });
  }
  const id = crypto.createHash("sha256").update(email).digest("hex");
  try {
    await firestore.setDocument("chongseb_leads", id, {
      email,
      consent: true,
      consentText: "Acepto recibir el portafolio y comunicaciones de CHONGSEB.",
      userId: String(body.userId || "").slice(0, 128),
      referralCode: String(body.referralCode || "").slice(0, 40),
      capturedAt: new Date(),
    });
    return json(200, { saved: true });
  } catch {
    return json(502, { error: "No fue posible guardar el correo" });
  }
};
