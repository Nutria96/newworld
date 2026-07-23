const cache = require("./_lib/cache");
const { checarLimite } = require("./_lib/rateLimit");
const { json, method } = require("./_lib/http");

exports.handler = async (event) => {
  const bad = method(event, "POST");
  if (bad) return bad;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const question = String(body.mensaje || "").trim();
  const session = String(body.sessionId || "anon").slice(0, 128);
  if (!question || question.length > 18000) {
    return json(400, { error: "Mensaje requerido (máximo 18000 caracteres)" });
  }

  const limit = checarLimite(session);
  if (!limit.permitido) {
    return json(429, { error: "Límite de sesión alcanzado", ...limit });
  }

  const simple = cache.intentarCalculoSimple(question);
  const saved = cache.get(question);
  if (simple || saved) {
    return json(200, {
      respuesta: simple || saved,
      cache: Boolean(saved),
      restantes: limit.restantes,
    });
  }

  const provider = process.env.AI_PROVIDER || "deepseek";
  const key =
    provider === "deepseek"
      ? process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY
      : process.env.AI_API_KEY;
  if (!key) return json(503, { error: "Chat no configurado" });

  const directBase =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://api.deepseek.com/v1";
  const model =
    process.env.AI_MODEL ||
    (provider === "openai" ? "gpt-4.1-mini" : "deepseek-chat");
  const system =
    "Sos el asistente de CHONGSEB. Respondé en español claro, natural, directo y seguro. Ayudá a orientar al cliente sobre diseño gráfico, branding, flyers y edición. No inventes fuentes, enlaces ni acciones.";

  const requestCompletion = async (base, apiKey, selectedModel) => {
    const cleanBase = base.replace(/\/+$/, "");
    const endpoint = cleanBase.endsWith("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
        max_tokens: 900,
      }),
    });
    if (!response.ok) throw new Error(`Proveedor respondió ${response.status}`);
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Respuesta vacía del proveedor");
    return answer;
  };

  try {
    let answer;
    const omniBase = process.env.OMNIROUTE_BASE_URL;
    const omniKey = process.env.OMNIROUTE_API_KEY;
    if (omniBase && omniKey) {
      try {
        answer = await requestCompletion(
          omniBase,
          omniKey,
          process.env.OMNIROUTE_MODEL || "auto",
        );
      } catch {
        answer = await requestCompletion(directBase, key, model);
      }
    } else {
      answer = await requestCompletion(directBase, key, model);
    }
    cache.set(question, answer);
    return json(200, { respuesta: answer, restantes: limit.restantes });
  } catch {
    return json(502, { error: "No fue posible conectar con el proveedor de IA" });
  }
};
