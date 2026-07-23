const { json, method } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const storeAuth = require("./_lib/storeAuth");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const userId = storeAuth.safeId(body.userId);
    if (!userId) return json(400, { error: "Invalid store user" });
    const existing = await firestore.getDocument("chongseb_store_access", userId);
    const trialStart = existing?.trialStart || new Date().toISOString();
    if (!existing) {
      await firestore.createDocument("chongseb_store_access", userId, {
        userId,
        trialStart,
        trialUsed: true,
        createdAt: trialStart,
      });
    }
    return {
      ...json(200, { ready: true }),
      multiValueHeaders: { "Set-Cookie": [storeAuth.cookie(userId)] },
    };
  } catch {
    return json(500, { error: "Store session unavailable" });
  }
};
