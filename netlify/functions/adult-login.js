const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { json, method } = require("./_lib/http");
const firestore = require("./_lib/firestore");
const auth = require("./_lib/adultAuth");

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  try {
    const body = JSON.parse(event.body || "{}");
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-z0-9_.-]{3,30}$/.test(username) || !password) return json(400, { error: "Invalid credentials" });
    const usernameId = crypto.createHash("sha256").update(username).digest("hex");
    const reserved = await firestore.getDocument("chongseb_adult_usernames", usernameId);
    const record = reserved?.userId ? await auth.record(reserved.userId) : null;
    if (!record?.passwordHash || !(await bcrypt.compare(password, record.passwordHash))) {
      return json(401, { error: "Invalid credentials" });
    }
    if (record.status !== "approved") return json(403, { error: "Manual approval pending" });
    return {
      ...json(200, { authenticated: true }),
      multiValueHeaders: { "Set-Cookie": [auth.sessionCookie(record.userId)] },
    };
  } catch {
    return json(500, { error: "Login unavailable" });
  }
};
