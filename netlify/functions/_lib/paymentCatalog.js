const crypto = require("node:crypto");
const firestore = require("./firestore");

function catalog() {
  try {
    const parsed = JSON.parse(process.env.SERVICE_CATALOG_JSON || "{}");
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([key, item]) =>
            /^[a-z0-9_-]{2,40}$/.test(key) &&
            item &&
            typeof item.name === "string" &&
            Number.isInteger(item.amount) &&
            item.amount >= 100,
        )
        .map(([key, item]) => [
          key,
          { name: item.name.slice(0, 120), amount: item.amount },
        ]),
    );
  } catch {
    return {};
  }
}

async function discountFor(code, userId) {
  if (!code || !userId || !firestore.configured()) return 0;
  try {
    const referral = await firestore.getDocument("chongseb_referrals", code);
    return referral?.ownerUserId === userId && Number(referral.visits) >= 3
      ? 15
      : 0;
  } catch {
    return 0;
  }
}

async function buildPurchase(body = {}) {
  const serviceKey = String(body.serviceKey || "");
  const services = catalog();
  const service = services[serviceKey];
  const donation = !serviceKey;
  if (!donation && !service) {
    const error = new Error("Servicio o precio no configurado");
    error.statusCode = 400;
    throw error;
  }
  const userId = String(body.userId || "").slice(0, 128);
  const referralCode = String(body.referralCode || "").slice(0, 40);
  const discount = donation
    ? 0
    : await discountFor(referralCode, userId);
  const baseAmount = donation
    ? Math.max(100, Number(process.env.DONATION_AMOUNT_CENTS || 5000))
    : service.amount;
  const amount = Math.max(100, Math.round(baseAmount * (1 - discount / 100)));
  const publicDonor = donation && body.publicDonor === true;
  const donorName = publicDonor
    ? String(body.donorName || "")
        .replace(/[^\p{L}\p{N} ._'’-]/gu, "")
        .trim()
        .slice(0, 60)
    : "";
  return {
    reference: crypto.randomUUID(),
    serviceKey: serviceKey || "donation",
    name: donation
      ? "Donación a CHONGSEB"
      : `${service.name}${discount ? ` (${discount}% referido)` : ""}`,
    amount,
    discount,
    userId,
    referralCode,
    publicDonor: publicDonor && Boolean(donorName),
    donorName,
  };
}

function siteUrl() {
  return String(
    process.env.SITE_URL || "https://chongseb.netlify.app",
  ).replace(/\/+$/, "");
}

async function savePending(id, provider, purchase) {
  if (!firestore.configured()) return;
  try {
    await firestore.setDocument("chongseb_pending_payments", id, {
      provider,
      ...purchase,
      createdAt: new Date(),
    });
  } catch {}
}

module.exports = { buildPurchase, siteUrl, savePending };
