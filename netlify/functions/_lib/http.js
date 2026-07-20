const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body) }; }
function method(event, expected) { return event.httpMethod === expected ? null : json(405, { error: "Método no permitido" }); }
module.exports = { json, method };
