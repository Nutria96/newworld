const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const { json, method } = require("./_lib/http");

function authorized(event) {
  const expected = String(process.env.ADMIN_PASSWORD_HASH || "").toLowerCase();
  const token = String(event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!/^[a-f0-9]{64}$/.test(expected) || !token) return false;
  const actual = crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

exports.handler = async (event) => {
  const bad = method(event, "GET");
  if (bad) return bad;
  if (!authorized(event)) return json(401, { error: "No autorizado" });
  if (!firestore.configured()) {
    return json(503, { error: "Firebase no configurado" });
  }
  try {
    const [referrals, leads, sales] = await Promise.all([
      firestore.listDocuments("chongseb_referrals"),
      firestore.listDocuments("chongseb_leads"),
      firestore.listDocuments("chongseb_sales"),
    ]);
    return json(200, {
      referrals: referrals.filter((item) => Number(item.visits) > 0).length,
      totalReferralCodes: referrals.length,
      eligibleReferrals: referrals.filter((item) => Number(item.visits) >= 3)
        .length,
      leads: leads.length,
      completedSales: sales.length,
      revenueMxn: sales.reduce(
        (sum, sale) => sum + Number(sale.amountTotal || 0),
        0,
      ) / 100,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return json(502, { error: "No fue posible leer las métricas" });
  }
};
