const crypto = require("node:crypto");
const { createPayPalOrder } = require("./create-paypal-checkout");
const {
  buildPurchase,
  siteUrl,
  savePending,
} = require("./_lib/paymentCatalog");
const { json, method } = require("./_lib/http");

async function mercadoPagoPreference(purchase) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no configurado");
  const externalReference = `mp_${purchase.reference}`;
  await savePending(externalReference, "mercadopago", purchase);
  const root = siteUrl();
  const response = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        items: [
          {
            id: purchase.serviceKey,
            title: purchase.name,
            quantity: 1,
            currency_id: "MXN",
            unit_price: purchase.amount / 100,
          },
        ],
        external_reference: externalReference,
        metadata: {
          service_key: purchase.serviceKey,
          referral_code: purchase.referralCode,
          user_id: purchase.userId,
          discount_percent: purchase.discount,
          public_donor: purchase.publicDonor,
          donor_name: purchase.donorName,
        },
        back_urls: {
          success: `${root}/?payment=success&provider=mercadopago`,
          pending: `${root}/?payment=pending&provider=mercadopago`,
          failure: `${root}/?payment=failed&provider=mercadopago`,
        },
        auto_return: "approved",
        notification_url: `${root}/.netlify/functions/mercadopago-webhook`,
        statement_descriptor: "CHONGSEB",
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || (!data.init_point && !data.sandbox_init_point)) {
    throw new Error("Mercado Pago rechazó la preferencia");
  }
  return {
    provider: "mercadopago",
    init_point: data.init_point || data.sandbox_init_point,
    preference_id: data.id,
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
  let purchase;
  try {
    purchase = await buildPurchase(body);
  } catch (error) {
    return json(error.statusCode || 400, { error: error.message });
  }
  try {
    return json(200, await mercadoPagoPreference(purchase));
  } catch (mercadoPagoError) {
    try {
      const paypal = await createPayPalOrder(purchase);
      return json(200, {
        ...paypal,
        fallback: true,
        fallback_reason: "Mercado Pago no disponible",
      });
    } catch {
      return json(502, {
        error: "Mercado Pago y PayPal no están disponibles",
      });
    }
  }
};

module.exports.mercadoPagoPreference = mercadoPagoPreference;
