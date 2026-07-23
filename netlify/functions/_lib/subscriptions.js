const plans = require("../../../adult/subscription-plans.json");
const firestore = require("./firestore");

function paidPlan(id) {
  return plans.find(plan => plan.id === id && Number(plan.price) > 0) || null;
}

function documentId(userId, product = "adult") {
  if (product === "store") return `${userId}_store`;
  if (product === "kids") return `${userId}_kids`;
  return userId;
}

async function get(userId, product = "adult") {
  return firestore.getDocument("chongseb_subscriptions", documentId(userId, product));
}

async function save(userId, data, product = "adult") {
  const previous = (await get(userId, product)) || {};
  return firestore.setDocument("chongseb_subscriptions", documentId(userId, product), {
    ...previous,
    ...data,
    userId,
    product,
    updatedAt: new Date().toISOString(),
  });
}

function entitlements(subscription) {
  const active =
    subscription?.status === "active" &&
    (!subscription.expiresAt || Date.parse(subscription.expiresAt) > Date.now());
  const plan = active && ["premium", "vip"].includes(subscription.plan)
    ? subscription.plan
    : active && subscription.plan === "store_premium"
      ? "store_premium"
      : active && subscription.plan === "kids_premium"
        ? "kids_premium"
      : "basic";
  return {
    plan,
    active: plan !== "basic",
    ads: plan === "basic",
    voice: ["premium", "vip"].includes(plan),
    exclusive: plan === "vip",
    characterLimit: plan === "basic" ? 3 : null,
    store: plan === "store_premium",
    kids: plan === "kids_premium",
  };
}

async function event(userId, data) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return firestore.setDocument("chongseb_subscription_events", id, {
    userId,
    ...data,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { plans, paidPlan, get, save, entitlements, event };
