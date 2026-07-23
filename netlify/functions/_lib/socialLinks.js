const PLATFORMS = {
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.watch"],
  instagram: ["instagram.com"],
};

function trustedHost(hostname, roots) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return roots.some(root => host === root || host.endsWith(`.${root}`));
}

function sanitizeLinks(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    const platform = String(item?.platform || "").toLowerCase();
    if (!PLATFORMS[platform] || typeof item?.title !== "string") continue;
    try {
      const url = new URL(String(item.url || ""));
      if (url.protocol !== "https:" || !trustedHost(url.hostname, PLATFORMS[platform])) continue;
      const title = item.title.trim().slice(0, 160);
      if (title) result.push({ platform, title, url: url.href });
    } catch {
      // Las URLs inventadas o mal formadas nunca llegan al navegador.
    }
    if (result.length === 3) break;
  }
  return result;
}

module.exports = { sanitizeLinks };
