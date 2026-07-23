let cached = null;
let expires = 0;

function base() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function token() {
  if (cached && Date.now() < expires - 60_000) return cached;
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID || ""}:${process.env.PAYPAL_SECRET || ""}`,
  ).toString("base64");
  const response = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal auth ${response.status}`);
  const data = await response.json();
  cached = data.access_token;
  expires = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cached;
}

module.exports = { base, token };
