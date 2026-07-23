const SEARCH_INTENT =
  /\b(enlace|enlaces|fuente|fuentes|recurso|recursos|buscar|investiga|internet|actual|hoy|link|links|source|sources|resource|search|latest|today)\b/i;

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function search(question) {
  if (!process.env.SERPAPI_KEY || !SEARCH_INTENT.test(question)) return [];
  const query = new URLSearchParams({
    engine: "google", q: question.slice(0, 500), api_key: process.env.SERPAPI_KEY,
    num: "6", safe: "active",
  });
  const response = await fetch(`https://serpapi.com/search.json?${query}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Search provider ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data.organic_results) ? data.organic_results : [])
    .map(item => ({
      type: "real",
      title: String(item?.title || "").trim().slice(0, 180),
      url: safeUrl(item?.link),
      description: String(item?.snippet || "").trim().slice(0, 500),
    }))
    .filter(item => item.title && item.url)
    .slice(0, 6);
}

module.exports = { SEARCH_INTENT, safeUrl, search };
