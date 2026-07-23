const { json } = require("./_lib/http");
const auth = require("./_lib/adultAuth");
const subscriptions = require("./_lib/subscriptions");

exports.handler = async event => {
  const session = auth.session(event);
  if (!session || session.scope !== "adult") return json(401, { error: "Authentication required" });
  const access = subscriptions.entitlements(await subscriptions.get(session.sub));
  if (!access.exclusive) return json(403, { error: "VIP subscription required" });
  let catalog = [];
  try {
    catalog = JSON.parse(process.env.VIP_CONTENT_JSON || "[]");
  } catch {}
  return json(200, {
    content: Array.isArray(catalog)
      ? catalog.map(item => ({
          id: String(item.id || ""),
          title: String(item.title || ""),
          type: ["image", "video"].includes(item.type) ? item.type : "image",
        }))
      : [],
  });
};
