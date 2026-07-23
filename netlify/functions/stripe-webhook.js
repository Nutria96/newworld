const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const { json, method } = require("./_lib/http");

function validSignature(payload, header, secret) {
  const parts = Object.fromEntries(
    String(header || "")
      .split(",")
      .map((part) => part.split("=", 2)),
  );
  const timestamp = Number(parts.t);
  const signature = String(parts.v1 || "");
  if (!timestamp || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: "Webhook no configurado" });
  if (!firestore.configured()) {
    return json(503, { error: "Firebase no configurado" });
  }
  const payload = event.body || "";
  if (!validSignature(payload, event.headers["stripe-signature"], secret)) {
    return json(400, { error: "Firma inválida" });
  }
  let stripeEvent;
  try {
    stripeEvent = JSON.parse(payload);
  } catch {
    return json(400, { error: "Evento inválido" });
  }
  if (stripeEvent.type !== "checkout.session.completed") {
    return json(200, { received: true });
  }
  const session = stripeEvent.data?.object || {};
  try {
    const existing = await firestore.getDocument(
      "chongseb_sales",
      String(session.id),
    );
    if (existing) return json(200, { received: true, duplicate: true });
    await firestore.setDocument("chongseb_sales", String(session.id), {
      sessionId: String(session.id),
      paymentStatus: String(session.payment_status || ""),
      amountTotal: Number(session.amount_total || 0),
      currency: String(session.currency || "mxn"),
      serviceKey: String(session.metadata?.service_key || ""),
      referralCode: String(session.metadata?.referral_code || ""),
      userId: String(session.metadata?.user_id || ""),
      discountPercent: Number(session.metadata?.discount_percent || 0),
      customerEmail: String(session.customer_details?.email || ""),
      publicDonor: session.metadata?.public_donor === "true",
      donorName:
        session.metadata?.public_donor === "true"
          ? String(session.metadata?.donor_name || "").slice(0, 60)
          : "",
      completedAt: new Date(),
    });
    const referralCode = String(session.metadata?.referral_code || "");
    if (referralCode) {
      const referral = await firestore.getDocument(
        "chongseb_referrals",
        referralCode,
      );
      if (referral) {
        await firestore.setDocument("chongseb_referrals", referralCode, {
          ownerUserId: referral.ownerUserId,
          visits: Number(referral.visits || 0),
          conversions: Number(referral.conversions || 0) + 1,
          createdAt: referral.createdAt || new Date(),
          updatedAt: new Date(),
        });
      }
    }
    return json(200, { received: true });
  } catch {
    return json(500, { error: "No fue posible registrar la venta" });
  }
};
