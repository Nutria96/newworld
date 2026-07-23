"use strict";

const { spawnSync } = require("node:child_process");

const EXPECTED_REPOSITORY = "Nutria96/newworld";
const COMMIT_MESSAGE = "Actualización automática: agente de búsqueda universal";

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: __dirname, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} falló`);
  }
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function repositoryFromRemote(remote) {
  const normalized = remote.replace(/\.git$/, "").replace(/\\/g, "/");
  const match = normalized.match(/github\.com[/:]([^/]+\/[^/]+)$/i);
  return match?.[1] || "";
}

function main() {
  if (!process.argv.includes("--confirm-main")) {
    throw new Error("Confirma el push ejecutando: node push-to-github.js --confirm-main");
  }
  if (git(["rev-parse", "--is-inside-work-tree"]).stdout !== "true") throw new Error("Esta carpeta no es un repositorio Git");
  const remote = git(["remote", "get-url", "origin"]).stdout;
  if (repositoryFromRemote(remote).toLowerCase() !== EXPECTED_REPOSITORY.toLowerCase()) {
    throw new Error(`El remoto origin no es ${EXPECTED_REPOSITORY}; se canceló el push`);
  }
  const branch = git(["branch", "--show-current"]).stdout;
  if (branch !== "main") throw new Error(`La rama activa es "${branch}", no "main"`);
  const status = git(["status", "--porcelain"]).stdout;
  if (!status) {
    console.log("No hay cambios que publicar.");
    return;
  }
  git(["add", "."]);
  const commit = git(["commit", "-m", COMMIT_MESSAGE], { allowFailure: true });
  if (!commit.ok) {
    const afterAdd = git(["diff", "--cached", "--quiet"], { allowFailure: true });
    if (afterAdd.ok) {
      console.log("No hay cambios nuevos que commitear.");
    } else {
      throw new Error(commit.stderr || "No se pudo crear el commit");
    }
  }
  git(["push", "origin", "main"]);
  console.log("Push completado en Nutria96/newworld (main).");
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
