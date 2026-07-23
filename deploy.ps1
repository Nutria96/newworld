#requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path ".git")) { throw "Ejecuta desde la raíz del repositorio." }
if (-not (Test-Path "public\index.html")) { throw "Falta public\index.html." }
if (-not (Get-Command netlify.cmd -ErrorAction SilentlyContinue)) {
    throw "Instala Netlify CLI: npm.cmd install -g netlify-cli"
}
if (git status --porcelain) { throw "Hay cambios sin guardar. Revísalos primero." }

git switch main
git pull --ff-only origin main

$answer = Read-Host "¿Desplegar main a producción en ultrainstinto? Escribe SI"
if ($answer -ne "SI") { throw "Despliegue cancelado." }

git add .
if (-not (git diff --cached --quiet)) {
    git commit -m "Deploy CHONGSEB production"
}
git push origin main

if (-not $env:NETLIFY_AUTH_TOKEN) {
    $secure = Read-Host "NETLIFY_AUTH_TOKEN" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $env:NETLIFY_AUTH_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}
if (-not $env:NETLIFY_SITE_ID) {
    $env:NETLIFY_SITE_ID = Read-Host "NETLIFY_SITE_ID (Project ID de ultrainstinto)"
}

netlify.cmd deploy --prod --dir=public --functions=netlify/functions `
    --site=$env:NETLIFY_SITE_ID --auth=$env:NETLIFY_AUTH_TOKEN
