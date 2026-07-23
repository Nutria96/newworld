const { json, method } = require("./_lib/http");
const mediaSession = require("./_lib/mediaSession");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const current = mediaSession.session(event);
    if (current) return json(200, { ready: true });
    const created = mediaSession.create();
    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "set-cookie": mediaSession.cookie(created), "cache-control": "no-store" },
      body: JSON.stringify({ ready: true }),
    };
  } catch (error) {
    console.error("media-session", error.message);
    return json(503, { error: "Media session unavailable" });
  }
};
