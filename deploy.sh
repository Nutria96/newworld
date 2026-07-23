#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"

[[ -d .git ]] || { echo "Ejecuta desde la raíz del repositorio."; exit 1; }
[[ -f public/index.html ]] || { echo "Falta public/index.html."; exit 1; }
command -v netlify >/dev/null || {
  echo "Instala Netlify CLI: npm install -g netlify-cli"
  exit 1
}
[[ -z "$(git status --porcelain)" ]] || {
  echo "Hay cambios sin guardar. Revísalos primero."
  exit 1
}

git switch main
git pull --ff-only origin main

read -r -p "¿Desplegar main a producción en ultrainstinto? Escribe SI: " answer
[[ "$answer" == "SI" ]] || { echo "Despliegue cancelado."; exit 1; }

git add .
git diff --cached --quiet || git commit -m "Deploy CHONGSEB production"
git push origin main

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  read -r -s -p "NETLIFY_AUTH_TOKEN: " NETLIFY_AUTH_TOKEN
  echo
  export NETLIFY_AUTH_TOKEN
fi
if [[ -z "${NETLIFY_SITE_ID:-}" ]]; then
  read -r -p "NETLIFY_SITE_ID (Project ID de ultrainstinto): " NETLIFY_SITE_ID
  export NETLIFY_SITE_ID
fi

netlify deploy --prod --dir=public --functions=netlify/functions \
  --site="$NETLIFY_SITE_ID" --auth="$NETLIFY_AUTH_TOKEN"
