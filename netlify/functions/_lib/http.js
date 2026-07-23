function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function method(event, expected) {
  return event.httpMethod === expected
    ? null
    : json(405, { error: "Method Not Allowed" });
}

module.exports = { json, method };
