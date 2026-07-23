const adultAuth = require("./adultAuth");
const mediaSession = require("./mediaSession");

async function authorize(event, scope) {
  if (scope === "adult") {
    const session = adultAuth.session(event);
    if (!session || session.scope !== "adult") return null;
    const record = await adultAuth.record(session.sub);
    return record?.status === "approved" ? { ownerId: session.sub, scope: "adult" } : null;
  }
  const session = mediaSession.session(event);
  return session?.scope === "media" ? { ownerId: session.sub, scope: "main" } : null;
}

module.exports = { authorize };
