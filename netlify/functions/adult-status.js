const { json } = require("./_lib/http");
const auth = require("./_lib/adultAuth");

exports.handler = async event => {
  const session = auth.session(event);
  if (session?.scope === "adult") {
    const record = await auth.record(session.sub);
    if (record?.status === "approved") return json(200, { authenticated: true, status: "approved" });
  }
  const userId = auth.safeId(event.queryStringParameters?.userId);
  const record = userId ? await auth.record(userId) : null;
  return json(200, { authenticated: false, status: record?.status || "none", biometricEnrolled: Boolean(record?.biometricEnrolled) });
};
