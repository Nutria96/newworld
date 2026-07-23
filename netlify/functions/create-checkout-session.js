const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { statusCode: 503, body: JSON.stringify({ error: "Stripe no configurado" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const amount = Math.max(100, Math.min(10000000, Number(body.amount) || 1500));
    const origin =
      event.headers.origin ||
      `https://${event.headers.host || "www.chongseb.com"}`;
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: Math.round(amount),
            product_data: { name: "Donación a CHONGSEB" },
          },
        },
      ],
      success_url: `${origin}/?donation=success`,
      cancel_url: `${origin}/?donation=cancelled`,
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No fue posible iniciar Stripe Checkout" }),
    };
  }
};
