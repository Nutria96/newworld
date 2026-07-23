const { json } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const storeAuth = require("./_lib/storeAuth");
const subscriptions = require("./_lib/subscriptions");
const household = require("./_lib/householdAccess");

exports.handler = async event => {
  if (await household.active(event)) {
    return json(200, {
      access: true,
      subscribed: false,
      household: true,
      trialActive: false,
      trialEndsAt: null,
      plan: "household_premium",
      subscription: null,
    });
  }
  const session = storeAuth.session(event);
  if (!session || session.scope !== "store") return json(401, { error: "Store session required" });
  const [trial, subscription] = await Promise.all([
    firestore.getDocument("chongseb_store_access", session.sub),
    subscriptions.get(session.sub, "store"),
  ]);
  const trialStart = trial?.trialStart ? Date.parse(trial.trialStart) : 0;
  const trialEndsAt = trialStart
    ? new Date(trialStart + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const trialActive = Boolean(
    trial?.trialUsed &&
      trialStart &&
      Date.now() < Date.parse(trialEndsAt),
  );
  const paid = subscriptions.entitlements(subscription);
  return json(200, {
    access: paid.store || trialActive,
    subscribed: paid.store,
    trialActive,
    trialEndsAt,
    plan: paid.store ? "store_premium" : "basic",
    subscription: subscription
      ? {
          status: subscription.status,
          provider: subscription.provider,
          expiresAt: subscription.expiresAt || null,
          cancellationPending: Boolean(subscription.cancellationPending),
        }
      : null,
  });
};
