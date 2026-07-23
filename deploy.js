#!/usr/bin/env node
"use strict";
const { execFileSync } = require("node:child_process");
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!token) throw new Error("Falta NETLIFY_AUTH_TOKEN.");
const site = process.env.NETLIFY_SITE_ID;
const args = ["deploy", "--prod", "--dir=.", "--auth", token, "--json"];
if (site) args.push("--site", site);
const out = JSON.parse(execFileSync(process.platform === "win32" ? "netlify.cmd" : "netlify", args, { encoding: "utf8" }));
console.log(out.deploy_url || out.url || out.ssl_url);
