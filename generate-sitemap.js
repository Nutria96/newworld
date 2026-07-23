"use strict";

const fs = require("node:fs");
const path = require("node:path");

const siteUrl = "https://chongseb.netlify.app/";
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap, "utf8");
console.log(`Sitemap actualizado a: ${today}`);
