const firestore = require("./_lib/firestore");
const { recordSale } = require("./_lib/sales");
const {
  apiBase,
  paypalAccessToken,
} = require("./create-paypal-checkout");
const { json, method } = require("./_lib/http");

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }
  const orderId = String(body.orderId || "");
  if (!/^[A-Z0-9]{8,40}$/i.test(orderId)) {
    return json(400, { error: "Orden PayPal inválida" });
  }
  try {
    const existing = await firestore.getDocument(
      "chongseb_sales",
      `paypal_${orderId}`,
    );
    if (existing) return json(200, { captured: true, duplicate: true });
    const token = await paypalAccessToken();
    const response = await fetch(
      `${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    const data = await response.json();
    if (!response.ok || data.status !== "COMPLETED") {
      return json(502, { error: "PayPal no confirmó el pago" });
    }
    const unit = data.purchase_units?.[0] || {};
    const capture = unit.payments?.captures?.[0] || {};
    const pending = unit.custom_id
      ? await firestore.getDocument(
          "chongseb_pending_payments",
          unit.custom_id,
        )
      : null;
    try {
      await recordSale(`paypal_${orderId}`, {
        provider: "paypal",
        providerPaymentId: String(capture.id || orderId),
        paymentStatus: "paid",
        amountTotal: Math.round(Number(capture.amount?.value || 0) * 100),
        currency: String(capture.amount?.currency_code || "MXN").toLowerCase(),
        serviceKey: String(pending?.serviceKey || unit.reference_id || ""),
        referralCode: String(pending?.referralCode || ""),
        userId: String(pending?.userId || ""),
        discountPercent: Number(pending?.discount || 0),
        publicDonor: Boolean(pending?.publicDonor),
        donorName: pending?.publicDonor ? String(pending.donorName || "") : "",
        customerEmail: String(data.payer?.email_address || ""),
      });
      return json(200, { captured: true, recorded: true });
    } catch {
      return json(200, { captured: true, recorded: false });
    }
  } catch {
    return json(502, { error: "No fue posible capturar la orden PayPal" });
  }
};
