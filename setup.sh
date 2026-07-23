#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

command -v git >/dev/null 2>&1 || { echo "❌ Instala Git primero."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Instala Node.js 18 o superior."; exit 1; }

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "❌ Define OPENAI_API_KEY antes de iniciar Auto-Boss."
  echo "   Ejemplo temporal: export OPENAI_API_KEY='tu_clave'"
  exit 1
fi

read -r -p "Usuario de GitHub: " GH_USER
read -r -p "Repositorio de GitHub: " GH_REPO
[[ "$GH_USER" =~ ^[A-Za-z0-9-]+$ && "$GH_REPO" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "❌ Datos de GitHub inválidos."; exit 1; }

[[ -d .git ]] || git init
git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/${GH_USER}/${GH_REPO}.git"
else
  git remote add origin "https://github.com/${GH_USER}/${GH_REPO}.git"
fi

# La IA revisa antes del lanzamiento; si cambia el HTML, crea su propio commit.
node auto-boss.js

git add .
if ! git diff --cached --quiet; then
  git commit -m "Lanzamiento de CHONGSEB con modo albañil dios"
fi

git push -u origin main
echo "✅ CHONGSEB fue enviado a GitHub. GitHub Actions iniciará Netlify."
