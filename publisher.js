"use strict";

const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");
const cron = require("node-cron");

const ROOT = __dirname;
const LOG_FILE = path.join(ROOT, "log.txt");
const SCHEDULE_FILE = path.join(ROOT, "schedule.json");
const ATTRIBUTION =
  "Publicado automáticamente por CHONGSEB Bot - Visita nuestra web: https://chongseb.netlify.app";
const SUPPORTED = new Set([
  "linkedin",
  "facebook",
  "twitter",
  "instagram",
  "whatsapp-webhook",
]);

function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function argumentsMap(argv) {
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") result.dryRun = true;
    else if (item === "--schedule") result.schedule = true;
    else if (item === "--run-due") result.runDue = true;
    else if (item === "--list") result.list = true;
    else if (item === "--post") result.post = argv[++index];
    else if (item === "--image") result.image = argv[++index];
    else if (item === "--platforms") result.platforms = argv[++index];
  }
  return result;
}

function audit(record) {
  const safe = { at: new Date().toISOString(), ...record };
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(safe)}\n`, "utf8");
}

function auditRows() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs
    .readFileSync(LOG_FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function assertHourlyLimit(platform) {
  const minutes = Math.max(
    60,
    Number(process.env.PUBLISHER_MIN_INTERVAL_MINUTES || 60),
  );
  const since = Date.now() - minutes * 60_000;
  const recent = auditRows().find(
    (row) =>
      row.platform === platform &&
      row.status === "published" &&
      Date.parse(row.at) > since,
  );
  if (recent) {
    throw new Error(
      `${platform}: espera hasta completar ${minutes} minutos desde la última publicación`,
    );
  }
}

function officialText(content) {
  const clean = String(content || "").trim();
  if (!clean) throw new Error("La publicación está vacía");
  return `${clean}\n\n${ATTRIBUTION}`;
}

function publicImage(image) {
  if (!image) return "";
  if (!/^https:\/\/\S+$/i.test(image)) {
    throw new Error(
      "La imagen debe ser una URL HTTPS pública para Facebook/Instagram; no se suben rutas locales automáticamente",
    );
  }
  return image;
}

async function request(config, attempts = 3) {
  let error;
  for (let count = 1; count <= attempts; count += 1) {
    try {
      const response = await axios({
        timeout: 20_000,
        validateStatus: null,
        ...config,
      });
      if (
        count < attempts &&
        (response.status === 429 || response.status >= 500)
      ) {
        error = new Error(`HTTP transitorio ${response.status}`);
      } else {
        return response;
      }
    } catch (caught) {
      error = caught;
    }
    if (count < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** count));
    }
  }
  throw error;
}

function ensureResponse(response, platform) {
  if (response.status >= 200 && response.status < 300) return response;
  const detail =
    response.data?.error?.message ||
    response.data?.detail ||
    `HTTP ${response.status}`;
  throw new Error(`${platform}: ${detail}`);
}

async function linkedin(text, image) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_AUTHOR_URN;
  if (!token || !author) throw new Error("LinkedIn no configurado");
  if (image) {
    throw new Error(
      "LinkedIn necesita registrar la imagen con Images API antes de publicar; se canceló para no omitirla",
    );
  }
  const response = await request({
    method: "POST",
    url: "https://api.linkedin.com/rest/posts",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "Linkedin-Version": process.env.LINKEDIN_VERSION || "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    data: {
      author,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });
  ensureResponse(response, "LinkedIn");
  return response.headers["x-restli-id"] || "published";
}

async function facebook(text, image) {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const page = process.env.FACEBOOK_PAGE_ID;
  if (!token || !page) throw new Error("Facebook no configurado");
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const url = image
    ? `https://graph.facebook.com/${version}/${page}/photos`
    : `https://graph.facebook.com/${version}/${page}/feed`;
  const data = image
    ? { url: publicImage(image), caption: text, access_token: token }
    : { message: text, access_token: token };
  const response = await request({ method: "POST", url, data });
  ensureResponse(response, "Facebook");
  return response.data?.post_id || response.data?.id || "published";
}

async function twitter(text, image) {
  const token =
    process.env.TWITTER_ACCESS_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error("X no configurado con token de usuario");
  if (image) {
    throw new Error(
      "X requiere subir la imagen primero y proporcionar un media_id; publicación de texto cancelada para no perder la imagen",
    );
  }
  const response = await request({
    method: "POST",
    url: "https://api.twitter.com/2/tweets",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    data: { text: text.slice(0, 280) },
  });
  ensureResponse(response, "X");
  return response.data?.data?.id || "published";
}

async function instagram(text, image) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const account = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!token || !account) throw new Error("Instagram no configurado");
  if (!image) throw new Error("Instagram necesita una imagen HTTPS pública");
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const media = await request({
    method: "POST",
    url: `https://graph.facebook.com/${version}/${account}/media`,
    data: {
      image_url: publicImage(image),
      caption: text,
      access_token: token,
    },
  });
  ensureResponse(media, "Instagram media");
  const publish = await request({
    method: "POST",
    url: `https://graph.facebook.com/${version}/${account}/media_publish`,
    data: { creation_id: media.data.id, access_token: token },
  });
  ensureResponse(publish, "Instagram publish");
  return publish.data?.id || "published";
}

async function whatsappWebhook(text, image) {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url || !/^https:\/\//i.test(url)) {
    throw new Error("Webhook de WhatsApp no configurado");
  }
  const response = await request({
    method: "POST",
    url,
    headers: { "content-type": "application/json" },
    data: { text, image: image || null, source: "CHONGSEB Bot" },
  });
  ensureResponse(response, "WhatsApp webhook");
  return response.data?.id || "delivered";
}

const handlers = {
  linkedin,
  facebook,
  twitter,
  instagram,
  "whatsapp-webhook": whatsappWebhook,
};

function configured(platform) {
  const keys = {
    linkedin: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"],
    facebook: ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"],
    twitter: ["TWITTER_ACCESS_TOKEN"],
    instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"],
    "whatsapp-webhook": ["WHATSAPP_WEBHOOK_URL"],
  }[platform];
  return keys?.every((key) => process.env[key]);
}

async function publishPost({ platforms, content, image, dryRun = false }) {
  const selected = [...new Set(platforms.map((item) => item.trim().toLowerCase()))];
  if (!selected.length || selected.some((item) => !SUPPORTED.has(item))) {
    throw new Error(`Plataformas válidas: ${[...SUPPORTED].join(", ")}`);
  }
  const text = officialText(content);
  const results = [];
  for (const platform of selected) {
    if (dryRun) {
      console.log(`[DRY-RUN:${platform}] ${text}${image ? ` | ${image}` : ""}`);
      results.push({ platform, status: "dry-run" });
      continue;
    }
    if (!configured(platform)) {
      console.log(`[SKIP:${platform}] faltan variables de entorno`);
      audit({ platform, status: "skipped", reason: "missing_config" });
      results.push({ platform, status: "skipped" });
      continue;
    }
    try {
      assertHourlyLimit(platform);
      const id = await handlers[platform](text, image);
      audit({ platform, status: "published", id });
      results.push({ platform, status: "published", id });
    } catch (error) {
      audit({ platform, status: "failed", error: error.message });
      results.push({ platform, status: "failed", error: error.message });
      console.error(`[ERROR:${platform}] ${error.message}`);
    }
  }
  return results;
}

function readSchedule() {
  const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf8"));
  if (!Array.isArray(data.posts)) throw new Error("schedule.json inválido");
  return data;
}

async function runDue(dryRun) {
  const data = readSchedule();
  const now = Date.now();
  for (const post of data.posts) {
    if (post.publishedAt || Date.parse(post.schedule) > now) continue;
    const results = await publishPost({
      platforms: post.platforms,
      content: post.content,
      image: post.image,
      dryRun,
    });
    if (!dryRun && results.some((item) => item.status === "published")) {
      post.publishedAt = new Date().toISOString();
    }
  }
  if (!dryRun) {
    fs.writeFileSync(SCHEDULE_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

async function main() {
  loadDotEnv();
  const args = argumentsMap(process.argv.slice(2));
  const dryRun =
    args.dryRun || String(process.env.PUBLISHER_DRY_RUN).toLowerCase() === "true";
  if (args.list) {
    const rows = readSchedule().posts.filter((post) => !post.publishedAt);
    console.table(
      rows.map(({ id, schedule, platforms, content }) => ({
        id,
        schedule,
        platforms: platforms.join(","),
        content: content.slice(0, 70),
      })),
    );
    return;
  }
  if (args.post) {
    if (!args.platforms) throw new Error("Falta --platforms");
    await publishPost({
      platforms: args.platforms.split(","),
      content: args.post,
      image: args.image || "",
      dryRun,
    });
    return;
  }
  if (args.runDue) {
    await runDue(dryRun);
    return;
  }
  if (args.schedule) {
    await runDue(dryRun);
    cron.schedule("* * * * *", () =>
      runDue(dryRun).catch((error) => console.error(error.message)),
    );
    console.log(`Scheduler activo${dryRun ? " en DRY-RUN" : ""}.`);
    return;
  }
  throw new Error("Usa --post, --schedule, --run-due o --list");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
