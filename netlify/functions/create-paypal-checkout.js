const crypto = require("node:crypto");
const {
  buildPurchase,
  siteUrl,
  savePending,
} = require("./_lib/paymentCatalog");
const { json, method } = require("./_lib/http");

function apiBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("PayPal no configurado");
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("No fue posible autenticar PayPal");
  }
  return data.access_token;
}

async function createPayPalOrder(purchase) {
  const token = await paypalAccessToken();
  const pendingId = `pp_${purchase.reference}`;
  await savePending(pendingId, "paypal", purchase);
  const root = siteUrl();
  const response = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: purchase.serviceKey,
          custom_id: pendingId,
          description: purchase.name,
          amount: {
            currency_code: "MXN",
            value: (purchase.amount / 100).toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "CHONGSEB",
            user_action: "PAY_NOW",
            return_url: `${root}/?paypal=return`,
            cancel_url: `${root}/?payment=cancelled&provider=paypal`,
          },
        },
      },
    }),
  });
  const data = await response.json();
  const approvalUrl = data.links?.find((link) => link.rel === "payer-action")
    ?.href || data.links?.find((link) => link.rel === "approve")?.href;
  if (!response.ok || !approvalUrl) {
    throw new Error("PayPal rechazó la orden");
  }
  return {
    provider: "paypal",
    approval_url: approvalUrl,
    order_id: data.id,
    amount: purchase.amount,
    discount: purchase.discount,
  };
}

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }
  try {
    const purchase = await buildPurchase(body);
    return json(200, await createPayPalOrder(purchase));
  } catch (error) {
    return json(error.statusCode || 502, { error: error.message });
  }
};

module.exports = {
  apiBase,
  paypalAccessToken,
  createPayPalOrder,
};
