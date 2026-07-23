const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const { recordSale } = require("./_lib/sales");
const { json, method } = require("./_lib/http");

function signatureParts(header) {
  return Object.fromEntries(
    String(header || "")
      .split(",")
      .map((part) => part.trim().split("=", 2)),
  );
}

function validSignature(event, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const parts = signatureParts(event.headers["x-signature"]);
  const requestId = String(event.headers["x-request-id"] || "");
  const timestamp = String(parts.ts || "");
  const signature = String(parts.v1 || "");
  if (!requestId || !timestamp || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const seconds = Number(timestamp) > 1e12
    ? Number(timestamp) / 1000
    : Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
    return false;
  }
  const manifest =
    `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;
  const queryId =
    event.queryStringParameters?.["data.id"] ||
    event.queryStringParameters?.data_id;
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {}
  const dataId = String(queryId || body.data?.id || "");
  if (!dataId || !validSignature(event, dataId)) {
    return json(401, { error: "Firma Mercado Pago inválida" });
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return json(503, { error: "Mercado Pago no configurado" });
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const payment = await response.json();
    if (!response.ok) return json(502, { error: "Pago no verificable" });
    if (payment.status !== "approved") return json(200, { received: true });
    const pending = payment.external_reference
      ? await firestore.getDocument(
          "chongseb_pending_payments",
          payment.external_reference,
        )
      : null;
    const metadata = payment.metadata || {};
    await recordSale(`mercadopago_${payment.id}`, {
      provider: "mercadopago",
      providerPaymentId: String(payment.id),
      paymentStatus: "paid",
      amountTotal: Math.round(Number(payment.transaction_amount || 0) * 100),
      currency: String(payment.currency_id || "MXN").toLowerCase(),
      serviceKey: String(
        pending?.serviceKey || metadata.service_key || "",
      ),
      referralCode: String(
        pending?.referralCode || metadata.referral_code || "",
      ),
      userId: String(pending?.userId || metadata.user_id || ""),
      discountPercent: Number(
        pending?.discount || metadata.discount_percent || 0,
      ),
      publicDonor: Boolean(
        pending?.publicDonor ||
          metadata.public_donor === true ||
          metadata.public_donor === "true",
      ),
      donorName:
        pending?.publicDonor ||
        metadata.public_donor === true ||
        metadata.public_donor === "true"
          ? String(pending?.donorName || metadata.donor_name || "").slice(0, 60)
          : "",
      customerEmail: String(payment.payer?.email || ""),
    });
    return json(200, { received: true });
  } catch {
    return json(500, { error: "No fue posible registrar Mercado Pago" });
  }
};
