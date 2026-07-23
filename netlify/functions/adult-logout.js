const { json } = require("./_lib/http");
const auth = require("./_lib/adultAuth");

exports.handler = async () => ({
  ...json(200, { authenticated: false }),
  multiValueHeaders: { "Set-Cookie": [auth.clearCookie()] },
});
