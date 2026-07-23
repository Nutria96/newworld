#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = __dirname;
const htmlPath = path.join(root, "index.html");
const backupPath = path.join(root, "index.backup.html");
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function validate(html) {
  const problems = [];
  if (!/^<!doctype html>/i.test(html.trim())) problems.push("Falta <!doctype html>.");
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problems.push("Falta viewport.");
  if (!html.includes("8331594714")) problems.push("Falta el teléfono requerido.");
  if (!html.includes("Ciudad Madero")) problems.push("Falta la dirección requerida.");
  if ((html.match(/<script\b/gi) || []).length !== (html.match(/<\/script>/gi) || []).length) problems.push("Etiquetas script desbalanceadas.");
  if (/sk-[A-Za-z0-9_-]{20,}/.test(html)) problems.push("Posible secreto incrustado.");
  return problems;
}

function git(args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
}

async function improve(html) {
  const prompt = `Audita este index.html de CHONGSEB. Conserva obligatoriamente marca, Carlos Chong, teléfono, dirección, enlaces y funcionalidad. Corrige solamente errores reales de HTML/CSS/JS, accesibilidad, responsividad o rendimiento. No agregues dependencias, APIs, rastreadores ni secretos. Devuelve exclusivamente el HTML completo corregido; si está bien, devuelve el mismo HTML.\n\n${html}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: prompt })
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const data = await response.json();
  const text = data.output_text || (data.output || []).flatMap(x => x.content || []).find(x => x.type === "output_text")?.text;
  if (!text) throw new Error("La API no devolvió HTML.");
  return text.replace(/^```html\s*/i, "").replace(/\s*```$/i, "").trim();
}

(async () => {
  if (!apiKey) fail("Define OPENAI_API_KEY antes de ejecutar. El token nunca debe guardarse en el código.");
  if (!fs.existsSync(htmlPath)) fail("No existe index.html.");

  const original = fs.readFileSync(htmlPath, "utf8");
  const originalProblems = validate(original);
  if (originalProblems.length) fail(`El archivo inicial no pasa validación: ${originalProblems.join(" ")}`);

  console.log(`🧠 Auto-Boss analiza index.html con ${model}...`);
  const candidate = await improve(original);
  const candidateProblems = validate(candidate);
  if (candidateProblems.length) fail(`Se rechazó la propuesta de la IA: ${candidateProblems.join(" ")}`);

  if (candidate === original.trim()) {
    console.log("✅ La nave ya está correcta; no hay cambios que confirmar.");
    return;
  }

  fs.copyFileSync(htmlPath, backupPath);
  fs.writeFileSync(htmlPath, `${candidate}\n`, "utf8");

  const diff = git(["diff", "--", "index.html"]);
  if (diff.status !== 0) {
    fs.copyFileSync(backupPath, htmlPath);
    fail("No se pudo revisar el diff; se restauró el respaldo.");
  }

  git(["add", "index.html"]);
  const commit = git(["commit", "-m", "Auto-Boss: mejora segura de CHONGSEB"]);
  if (commit.status !== 0) {
    console.error(commit.stderr || commit.stdout);
    fail("No se pudo crear el commit.");
  }
  console.log("✅ Mejora validada, respaldo creado y commit generado.");

  if (process.env.AUTO_BOSS_PUSH === "1") {
    const push = git(["push"]);
    if (push.status !== 0) fail(push.stderr || "Falló git push.");
    console.log("🚀 Commit enviado a GitHub.");
  } else {
    console.log("ℹ️ Ejecuta git push, o define AUTO_BOSS_PUSH=1 para subir automáticamente.");
  }
})().catch(error => fail(error.message));
