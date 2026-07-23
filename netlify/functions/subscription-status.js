const { json } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const firestore = require("./_lib/firestore");
const subscriptions = require("./_lib/subscriptions");
const household = require("./_lib/householdAccess");
const promo = require("./_lib/adultPromo");

exports.handler = async event => {
  const session = auth.session(event);
  if (!session || session.scope !== "adult") return json(401, { error: "Authentication required" });
  const record = await auth.record(session.sub);
  if (record?.status !== "approved") return json(403, { error: "Manual approval required" });
  const householdActive = await household.active(event);
  const promoState = await promo.state();
  const subscription = await subscriptions.get(session.sub);
  const access = subscriptions.entitlements(subscription);
  const events = (await firestore.listDocuments("chongseb_subscription_events", 300))
    .filter(item => item.userId === session.sub && item.product !== "store")
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 30)
    .map(({ type, plan, provider, status, createdAt }) => ({ type, plan, provider, status, createdAt }));
  return json(200, {
    ...(householdActive
      ? {
          plan: "household_premium",
          active: true,
          ads: false,
          voice: true,
          exclusive: false,
          characterLimit: null,
          store: true,
          kids: true,
          household: true,
        }
      : promoState.active
        ? {
            plan: "promo_premium",
            active: true,
            ads: false,
            voice: true,
            exclusive: false,
            characterLimit: null,
            store: false,
            kids: false,
            promotion: true,
            promotionExpiresAt: promoState.expiresAt,
          }
      : access),
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          provider: subscription.provider,
          expiresAt: subscription.expiresAt || null,
        }
      : null,
    events,
  });
};
