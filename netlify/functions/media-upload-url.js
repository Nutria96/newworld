const crypto = require("node:crypto");
const { json, method } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const media = require("./_lib/mediaStorage");
const { authorize } = require("./_lib/mediaAuth");
const { checarLimite } = require("./_lib/rateLimit");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  if (!media.enabled()) return json(503, { error: "Media uploads disabled" });
  try {
    const body = JSON.parse(event.body || "{}");
    const scope = body.scope === "adult" ? "adult" : "main";
    const actor = await authorize(event, scope);
    if (!actor) return json(scope === "adult" ? 403 : 401, { error: "Media authentication required" });
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length || files.length > media.MAX_FILES) return json(400, { error: `Select 1 to ${media.MAX_FILES} files` });
    const chatId = String(body.chatId || "default").slice(0, 128);
    const limit = checarLimite(`media:${actor.ownerId}`);
    if (!limit.permitido) return json(429, { error: "Upload rate limit exceeded" });

    const uploads = [];
    for (const raw of files) {
      const file = media.validateFile(raw);
      const id = crypto.randomUUID().replaceAll("-", "");
      const path = media.objectPath(scope, actor.ownerId, chatId, id, file.name);
      await firestore.setDocument("chongseb_media", id, {
        ownerId: actor.ownerId, scope, chatId, objectPath: path,
        ...file, kind: media.kind(file.type), status: "pending", createdAt: new Date().toISOString(),
      });
      uploads.push({
        id, name: file.name, type: file.type, size: file.size, kind: media.kind(file.type),
        uploadUrl: await media.uploadUrl(path, file.type),
      });
    }
    return json(200, { uploads });
  } catch (error) {
    console.error("media-upload-url", error.message);
    return json(400, { error: error.message === "File type not allowed" ? error.message : "Invalid upload request" });
  }
};
