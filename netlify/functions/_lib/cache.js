const values = new Map();
const MAX_ITEMS = 300;
const TTL = 10 * 60_000;

function key(question) {
  return String(question || "").trim().toLocaleLowerCase("es");
}

function get(question) {
  const item = values.get(key(question));
  if (!item || item.expiresAt < Date.now()) {
    values.delete(key(question));
    return null;
  }
  return item.value;
}

function set(question, value) {
  if (values.size >= MAX_ITEMS) values.delete(values.keys().next().value);
  values.set(key(question), { value, expiresAt: Date.now() + TTL });
}

function intentarCalculoSimple() {
  return null;
}

module.exports = { get, set, intentarCalculoSimple };
