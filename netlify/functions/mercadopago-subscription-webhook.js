const crypto = require("node:crypto");
const firestore = require("./_lib/firestore");
const subscriptions = require("./_lib/subscriptions");
const { json, method } = require("./_lib/http");

function signatureParts(header) {
  return Object.fromEntries(
    String(header || "").split(",").map(part => part.trim().split("=", 2)),
  );
}

function valid(event, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const parts = signatureParts(event.headers["x-signature"]);
  const requestId = String(event.headers["x-request-id"] || "");
  const timestamp = String(parts.ts || "");
  const supplied = String(parts.v1 || "");
  if (!secret || !requestId || !timestamp || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const seconds = Number(timestamp) > 1e12 ? Number(timestamp) / 1000 : Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const dataId = String(
    event.queryStringParameters?.["data.id"] ||
      event.queryStringParameters?.data_id ||
      body.data?.id ||
      "",
  );
  if (!dataId || !valid(event, dataId)) return json(401, { error: "Invalid signature" });
  try {
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`,
      { headers: { authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } },
    );
    const resource = await response.json();
    if (!response.ok) throw new Error(`Mercado Pago ${response.status}`);
    const records = await firestore.listDocuments("chongseb_subscriptions", 1000);
    const current = records.find(item => item.provider === "mercadopago" && item.providerSubscriptionId === dataId);
    const reference = String(resource.external_reference || "").split(":");
    const userId = current?.userId || reference[0];
    const plan = current?.plan || reference[1];
    const product = current?.product || (plan === "store_premium" ? "store" : plan === "kids_premium" ? "kids" : "adult");
    if (!userId || !plan) return json(200, { received: true, matched: false });
    let status =
      resource.status === "authorized"
        ? "active"
        : ["canceled", "cancelled"].includes(resource.status)
          ? "canceled"
          : resource.status === "paused"
            ? "inactive"
            : "pending";
    const preserveUntilExpiry =
      status === "canceled" &&
      current?.expiresAt &&
      Date.parse(current.expiresAt) > Date.now();
    if (preserveUntilExpiry) status = "active";
    const expiresAt = status === "active"
      ? new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()
      : current?.expiresAt || "";
    await subscriptions.save(userId, { plan, status, provider: "mercadopago", providerSubscriptionId: dataId, expiresAt, cancellationPending: preserveUntilExpiry }, product);
    await subscriptions.event(userId, { type: "mercadopago_webhook", plan, provider: "mercadopago", status, providerSubscriptionId: dataId, product });
    return json(200, { received: true });
  } catch (error) {
    console.error("mercadopago-subscription-webhook", error.message);
    return json(500, { error: "Webhook processing failed" });
  }
};
