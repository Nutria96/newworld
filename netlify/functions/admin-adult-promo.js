const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const promo = require("./_lib/adultPromo");
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
    if (event.httpMethod === "GET") return json(200, await promo.state());
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    const body = JSON.parse(event.body || "{}");
    if (body.action === "activate") return json(200, await promo.activate());
    if (body.action === "deactivate") return json(200, await promo.deactivate());
    return json(400, { error: "Acción inválida" });
  } catch (error) {
    console.error("admin-adult-promo", error.message);
    return json(500, { error: "No se pudo gestionar la promoción" });
  }
};
