const { json, method } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const subscriptions = require("./_lib/subscriptions");
const paypal = require("./_lib/paypal");
const storeAuth = require("./_lib/storeAuth");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const product = ["store", "kids"].includes(body.product) ? body.product : "adult";
    const session = product === "store" ? storeAuth.session(event) : auth.session(event);
    const expectedScope = product === "store" ? "store" : "adult";
    if (!session || session.scope !== expectedScope) return json(401, { error: "Authentication required" });
    const current = await subscriptions.get(session.sub, product);
    if (!current?.providerSubscriptionId || !["active", "pending"].includes(current.status)) {
      return json(409, { error: "No cancelable subscription" });
    }
    let response;
    if (current.provider === "mercadopago") {
      response = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(current.providerSubscriptionId)}`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "canceled" }),
        },
      );
    } else if (current.provider === "paypal") {
      response = await fetch(
        `${paypal.base()}/v1/billing/subscriptions/${encodeURIComponent(current.providerSubscriptionId)}/cancel`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${await paypal.token()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Canceled by subscriber" }),
        },
      );
    } else {
      return json(400, { error: "Unknown provider" });
    }
    if (!response.ok) throw new Error(`Provider cancellation ${response.status}`);
    const retainUntilExpiry =
      current.status === "active" &&
      current.expiresAt &&
      Date.parse(current.expiresAt) > Date.now();
    await subscriptions.save(
      session.sub,
      {
        status: retainUntilExpiry ? "active" : "canceled",
        cancellationPending: retainUntilExpiry,
        canceledAt: new Date().toISOString(),
      },
      product,
    );
    await subscriptions.event(session.sub, {
      type: "subscription_canceled",
      plan: current.plan,
      provider: current.provider,
      providerSubscriptionId: current.providerSubscriptionId,
      status: retainUntilExpiry ? "active_until_period_end" : "canceled",
      product,
    });
    return json(200, { canceled: true });
  } catch (error) {
    console.error("cancel-subscription", error.message);
    return json(502, { error: "Could not cancel subscription" });
  }
};
