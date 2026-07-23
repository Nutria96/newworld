const firestore = require("./_lib/firestore");
const subscriptions = require("./_lib/subscriptions");
const paypal = require("./_lib/paypal");
const { json, method } = require("./_lib/http");

async function verified(event, webhookEvent) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const response = await fetch(`${paypal.base()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await paypal.token()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: event.headers["paypal-auth-algo"],
      cert_url: event.headers["paypal-cert-url"],
      transmission_id: event.headers["paypal-transmission-id"],
      transmission_sig: event.headers["paypal-transmission-sig"],
      transmission_time: event.headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent,
    }),
  });
  const data = await response.json();
  return response.ok && data.verification_status === "SUCCESS";
}

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const webhook = JSON.parse(event.body || "{}");
    if (!(await verified(event, webhook))) return json(401, { error: "Invalid signature" });
    const resource = webhook.resource || {};
    const subscriptionId = String(resource.id || "");
    const records = await firestore.listDocuments("chongseb_subscriptions", 1000);
    const current = records.find(item => item.provider === "paypal" && item.providerSubscriptionId === subscriptionId);
    const reference = String(resource.custom_id || "").split(":");
    const userId = current?.userId || reference[0];
    const plan = current?.plan || reference[1];
    const product = current?.product || (plan === "store_premium" ? "store" : plan === "kids_premium" ? "kids" : "adult");
    if (!userId || !plan) return json(200, { received: true, matched: false });
    const providerStatus = String(resource.status || "").toUpperCase();
    let status =
      providerStatus === "ACTIVE"
        ? "active"
        : providerStatus === "CANCELLED"
          ? "canceled"
          : ["SUSPENDED", "EXPIRED"].includes(providerStatus)
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
    await subscriptions.save(userId, { plan, status, provider: "paypal", providerSubscriptionId: subscriptionId, expiresAt, cancellationPending: preserveUntilExpiry }, product);
    await subscriptions.event(userId, { type: webhook.event_type || "paypal_webhook", plan, provider: "paypal", status, providerSubscriptionId: subscriptionId, product });
    return json(200, { received: true });
  } catch (error) {
    console.error("paypal-subscription-webhook", error.message);
    return json(500, { error: "Webhook processing failed" });
  }
};
