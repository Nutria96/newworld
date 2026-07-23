const { json, method } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const media = require("./_lib/mediaStorage");
const { authorize } = require("./_lib/mediaAuth");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const scope = body.scope === "adult" ? "adult" : "main";
    const actor = await authorize(event, scope);
    if (!actor) return json(scope === "adult" ? 403 : 401, { error: "Media authentication required" });
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, media.MAX_FILES) : [];
    const attachments = [];
    for (const id of ids) {
      if (!/^[a-f0-9]{32}$/.test(String(id))) continue;
      const record = await firestore.getDocument("chongseb_media", id);
      if (!record || record.ownerId !== actor.ownerId || record.scope !== scope) continue;
      const file = media.bucket().file(record.objectPath);
      const [metadata] = await file.getMetadata();
      const actualSize = Number(metadata.size);
      if (actualSize !== Number(record.size) || actualSize > media.MAX_BYTES || metadata.contentType !== record.type) {
        await file.delete({ ignoreNotFound: true });
        continue;
      }
      await firestore.setDocument("chongseb_media", id, { ...record, status: "ready", completedAt: new Date().toISOString() });
      attachments.push({ id, name: record.name, type: record.type, size: actualSize, kind: record.kind });
    }
    if (!attachments.length) return json(400, { error: "No valid uploads completed" });
    return json(200, { attachments });
  } catch (error) {
    console.error("media-complete", error.message);
    return json(500, { error: "Could not verify upload" });
  }
};
