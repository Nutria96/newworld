const { json } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const subscriptions = require("./_lib/subscriptions");
const household = require("./_lib/householdAccess");

exports.handler = async event => {
  if (await household.active(event)) {
    return json(200, {
      authenticated: true,
      active: true,
      household: true,
      plan: "household_premium",
    });
  }
  const session = auth.session(event);
  if (!session || session.scope !== "adult") {
    return json(200, { authenticated: false, active: false, plan: "basic" });
  }
  const record = await auth.record(session.sub);
  if (record?.status !== "approved") {
    return json(200, { authenticated: false, active: false, plan: "basic" });
  }
  const access = subscriptions.entitlements(
    await subscriptions.get(session.sub, "kids"),
  );
  return json(200, {
    authenticated: true,
    active: access.kids,
    plan: access.kids ? "kids_premium" : "basic",
  });
};
