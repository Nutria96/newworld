const cache = require("./_lib/cache");
const { checarLimite } = require("./_lib/rateLimit");
const { json, method } = require("./_lib/http");

const CURRENT_RE = /\b(hoy|actual|actualidad|noticia|últim[oa]s?|reciente|precio|clima|presidente|resultado)\b/i;

function educationalIntent(question) {
  if (/^explica\s+/i.test(question)) return "Explicá el tema paso a paso, con una analogía cotidiana y un ejemplo práctico.";
  if (/^ejercicio\s+/i.test(question)) return "Creá un ejercicio práctico, da una pista y coloca la solución al final bajo un encabezado separado.";
  if (/^resumen\s+/i.test(question)) return "Prepará un resumen conciso con los conceptos esenciales y una lista corta de ideas clave.";
  return "Adaptá la profundidad a la pregunta y comprobá que la explicación sea fácil de seguir.";
}

async function searchWeb(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { context: "", sources: [], unavailable: true };
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "es");
  url.searchParams.set("num", "5");
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("La búsqueda web no respondió");
  const data = await response.json();
  const results = (data.organic_results || []).slice(0, 5).filter(item => item.link && item.snippet);
  return {
    context: results.map((item, index) => `[${index + 1}] ${item.title}\n${item.snippet}\n${item.link}`).join("\n\n"),
    sources: results.map(item => ({ title: item.title, url: item.link })),
    unavailable: false
  };
}

exports.handler = async event => {
  const badMethod = method(event, "POST");
  if (badMethod) return badMethod;
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "El mensaje no tiene un formato válido." }); }
  const question = String(body.mensaje || "").trim();
  const session = String(body.sessionId || "anon").slice(0, 128);
  if (!question || question.length > 18000) return json(400, { error: "Escribí un mensaje de hasta 18 000 caracteres." });
  const limit = checarLimite(session);
  if (!limit.permitido) return json(429, { error: "Llegaste al límite temporal de esta sesión. Esperá un momento y probá otra vez.", ...limit });
  const simple = cache.intentarCalculoSimple(question);
  const saved = cache.get(question);
  if (simple || saved) return json(200, { respuesta: simple || saved, cache: Boolean(saved), restantes: limit.restantes, sources: [] });

  const provider = String(process.env.AI_PROVIDER || "deepseek").toLowerCase();
  const key = process.env.AI_API_KEY || (provider === "openai" ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY);
  if (!key) return json(503, { error: "El tutor todavía no tiene una clave de IA configurada. Agregá AI_API_KEY o DEEPSEEK_API_KEY en Netlify y volvé a intentarlo.", code: "AI_NOT_CONFIGURED" });

  const needsWeb = Boolean(body.requireSources) || CURRENT_RE.test(question);
  let web = { context: "", sources: [], unavailable: false };
  if (needsWeb) web = await searchWeb(question);
  const base = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
  const model = process.env.AI_MODEL || (provider === "openai" ? "gpt-4.1-mini" : "deepseek-chat");
  const system = [
    "Sos Chongoku, un tutor educativo paciente, natural y claro.",
    "Respondé en español con tono humano y coloquial, como un buen profesor que quiere que la persona entienda de verdad.",
    "Explicá paso a paso cuando ayude, usá ejemplos prácticos y analogías cotidianas, y evitá relleno o frases robóticas.",
    "Si no sabés algo, decilo con honestidad. No inventes hechos, fuentes, enlaces ni resultados.",
    educationalIntent(question),
    needsWeb && web.unavailable ? "La pregunta requiere actualidad, pero la búsqueda web no está configurada. Aclará esa limitación." : "",
    web.context ? "Usá el contexto web siguiente. Citá las fuentes por nombre y no afirmes más de lo que dicen:\n" + web.context : ""
  ].filter(Boolean).join("\n\n");

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: question }], max_tokens: 1000 })
  });
  if (!response.ok) {
    console.error("AI provider error", response.status);
    return json(502, {
      error: `El proveedor de IA rechazó la solicitud (HTTP ${response.status}). Revisá la clave, el saldo y el modelo configurados.`,
      code: "AI_PROVIDER_ERROR",
      providerStatus: response.status
    });
  }
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) return json(502, { error: "El proveedor devolvió una respuesta vacía.", code: "AI_EMPTY_RESPONSE" });
  cache.set(question, answer);
  return json(200, { respuesta: answer, sources: web.sources, restantes: limit.restantes });
};
