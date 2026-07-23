const crypto = require("node:crypto");
const { json, method } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const storage = require("./_lib/privateStorage");
const subscriptions = require("./_lib/subscriptions");
const paypal = require("./_lib/paypal");
const storeAuth = require("./_lib/storeAuth");

async function emailFor(record) {
  if (!record?.profileObject) throw new Error("Verified profile missing");
  const profile = JSON.parse((await storage.downloadDecrypted(record.profileObject)).toString("utf8"));
  if (!profile.email) throw new Error("Subscriber email missing");
  return profile.email;
}

async function mercadoPago(plan, userId, email) {
  const planId = process.env[plan.mercadopago_plan_env];
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN || !planId) throw new Error("Mercado Pago plan not configured");
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "content-type": "application/json",
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      preapproval_plan_id: planId,
      payer_email: email,
      external_reference: `${userId}:${plan.id}`,
      back_url: `${process.env.SITE_URL || "https://chongseb.netlify.app"}/account?subscription=return`,
      status: "pending",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.init_point || !data.id) throw new Error(`Mercado Pago ${response.status}`);
  return { id: data.id, checkoutUrl: data.init_point };
}

async function payPal(plan, userId) {
  const planId = process.env[plan.paypal_plan_env];
  if (!planId) throw new Error("PayPal plan not configured");
  const access = await paypal.token();
  const site = process.env.SITE_URL || "https://chongseb.netlify.app";
  const response = await fetch(`${paypal.base()}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${access}`,
      "content-type": "application/json",
      "paypal-request-id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: `${userId}:${plan.id}`,
      application_context: {
        brand_name: "CHONGSEB",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${site}/account?subscription=return`,
        cancel_url: `${site}/account?subscription=cancel`,
      },
    }),
  });
  const data = await response.json();
  const checkoutUrl = data.links?.find(link => link.rel === "approve")?.href;
  if (!response.ok || !checkoutUrl || !data.id) throw new Error(`PayPal ${response.status}`);
  return { id: data.id, checkoutUrl };
}

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const plan = subscriptions.paidPlan(body.planId);
    const product =
      plan?.id === "store_premium"
        ? "store"
        : plan?.id === "kids_premium"
          ? "kids"
          : "adult";
    const session = product === "store" ? storeAuth.session(event) : auth.session(event);
    const expectedScope = product === "store" ? "store" : "adult";
    if (!session || session.scope !== expectedScope) return json(401, { error: "Parent authentication required" });
    const accessRecord = product !== "store" ? await auth.record(session.sub) : null;
    if (product !== "store" && accessRecord?.status !== "approved") {
      return json(403, { error: "Manual approval required" });
    }
    const provider = String(body.paymentMethod || "").toLowerCase();
    if (!plan || !["mercadopago", "paypal"].includes(provider)) return json(400, { error: "Invalid subscription request" });
    const current = await subscriptions.get(session.sub, product);
    if (subscriptions.entitlements(current).active) return json(409, { error: "Cancel the active subscription before changing provider" });
    const payerEmail =
      product === "store"
        ? String(body.payerEmail || "").trim().toLowerCase()
        : await emailFor(accessRecord);
    if (provider === "mercadopago" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return json(400, { error: "Valid payer email required" });
    }
    const created =
      provider === "mercadopago"
        ? await mercadoPago(plan, session.sub, payerEmail)
        : await payPal(plan, session.sub);
    await subscriptions.save(session.sub, {
      plan: plan.id,
      status: "pending",
      provider,
      providerSubscriptionId: created.id,
      expiresAt: "",
    }, product);
    await subscriptions.event(session.sub, {
      type: "subscription_created",
      plan: plan.id,
      provider,
      providerSubscriptionId: created.id,
      status: "pending",
      product,
    });
    return json(201, { checkoutUrl: created.checkoutUrl });
  } catch (error) {
    console.error("create-subscription", error.message);
    return json(502, { error: "Could not create subscription" });
  }
};
