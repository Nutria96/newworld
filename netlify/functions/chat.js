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

  const base =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://api.deepseek.com/v1";
  const model =
    process.env.AI_MODEL ||
    (provider === "openai" ? "gpt-4.1-mini" : "deepseek-chat");
  const system =
    "Sos el asistente de CHONGSEB. Respondé en español claro, natural, directo y seguro. Ayudá a orientar al cliente sobre diseño gráfico, branding, flyers y edición. No inventes fuentes, enlaces ni acciones.";

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      return json(502, { error: "El proveedor de IA no respondió" });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return json(502, { error: "Respuesta vacía del proveedor" });

    cache.set(question, answer);
    return json(200, { respuesta: answer, restantes: limit.restantes });
  } catch {
    return json(502, { error: "No fue posible conectar con el proveedor de IA" });
  }
};
