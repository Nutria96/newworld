const { json } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const media = require("./_lib/mediaStorage");
const { authorize } = require("./_lib/mediaAuth");

exports.handler = async event => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });
  try {
    const id = String(event.queryStringParameters?.id || "");
    const scope = event.queryStringParameters?.scope === "adult" ? "adult" : "main";
    if (!/^[a-f0-9]{32}$/.test(id)) return json(400, { error: "Invalid attachment" });
    const actor = await authorize(event, scope);
    if (!actor) return json(scope === "adult" ? 403 : 401, { error: "Media authentication required" });
    const record = await firestore.getDocument("chongseb_media", id);
    if (!record || record.status !== "ready" || record.ownerId !== actor.ownerId || record.scope !== scope) {
      return json(404, { error: "Attachment not found" });
    }
    return json(200, await media.readUrl(record.objectPath));
  } catch (error) {
    console.error("media-download", error.message);
    return json(500, { error: "Could not open attachment" });
  }
};
