# Lanzamiento global de CHONGSEB

Este plan publica la web y prepara Discord sin exponer secretos ni conceder privilegios innecesarios. Ejecuta primero un Deploy Preview o una rama de validación si el repositorio todavía tiene cambios grandes.

## A. Publicación web con GitHub Actions y Netlify

### 1. Trabajar dentro del clon real

La carpeta de salida de Codex puede no ser un repositorio Git. Antes de copiar o publicar:

```powershell
git rev-parse --show-toplevel
git remote get-url origin
git branch --show-current
```

Confirma:

- el remoto es `https://github.com/Nutria96/newworld.git` o su equivalente SSH;
- la rama destinada a producción es `main`;
- `git status --short` no contiene archivos inesperados;
- no existen `.env`, tokens, claves privadas, documentos de identidad ni archivos multimedia personales en el commit.

### 2. Verificar estructura

En la raíz deben estar:

- `index.html`
- `netlify.toml`
- `package.json`
- `manifest.json`, `sw.js`, `nutria-icon.svg`
- `.github/workflows/deploy.yml`
- `netlify/functions/`
- `adult/`, `kids/`, `account/`, `admin/`
- `locales/`
- `commands/`, `discord/`, `music-bot/`

Ejecuta validaciones locales que no consumen APIs:

```powershell
node --check netlify/functions/chat.js
node --check setup-chongseb.js
node --check commands/nutria-control.js
node --check music-bot/music.js
npm install
```

### 3. Secretos de GitHub Actions

En GitHub abre **Settings → Secrets and variables → Actions** y configura:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID` del proyecto Netlify correcto

El workflow también contiene un anuncio posterior al deploy. Para usarlo configura:

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_AUTHOR_URN`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `FACEBOOK_PAGE_ID`

Si no vas a publicar automáticamente en redes, desactiva ese paso antes del lanzamiento. Nunca añadas secretos al YAML.

### 4. Variables de Netlify

En **Site configuration → Environment variables**, configura solamente las integraciones activas y aplica los contextos adecuados.

Principales:

- `DEEPSEEK_API_KEY`, `AI_MODEL`
- `SERPAPI_KEY`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `MEDIA_SESSION_SECRET`, `MEDIA_UPLOADS_ENABLED`
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`
- IDs de planes de Mercado Pago y PayPal
- `JWT_SECRET`, `ADULT_SESSION_SECRET`, `IDENTITY_ENCRYPTION_KEY`
- `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
- `ADMIN_PASSWORD_HASH`, `HOUSEHOLD_ACCESS_SECRET`
- `SITE_URL`

Esta arquitectura no necesita exponer `FIREBASE_API_KEY` al navegador para las subidas: utiliza URLs firmadas desde el backend. Consulta `.env.example` y `MEDIA_STORAGE_SETUP.md`.

### 5. Configuración externa

- Mantén Firebase Storage privado y aplica `firebase-storage-cors.json`.
- Registra webhooks de pago en las URLs exactas de las Netlify Functions.
- Usa Sandbox de PayPal y credenciales de prueba de Mercado Pago antes de Live.
- Confirma que `SITE_URL`, WebAuthn y URLs de retorno usan el dominio final.
- La política CSP permite el bucket de almacenamiento; no añadas dominios comodín innecesarios.

### 6. Commit y push

Revisa primero:

```powershell
git diff --check
git status --short
git diff --stat
```

Después:

```powershell
git add .
git commit -m "Lanzamiento global CHONGSEB"
git push origin main
```

El push activa `.github/workflows/deploy.yml`. No asumas un tiempo fijo: abre **GitHub → Actions**, espera a que el workflow termine en verde y revisa sus logs.

### 7. Verificación de producción

Confirma el dominio real mostrado por Netlify. Puede ser el dominio personalizado de CHONGSEB o el subdominio asignado al proyecto; no presupongas que `chongseb.netlify.app` pertenece al sitio.

Verifica:

- `/`, `/adult`, `/kids`, `/account` y `/admin`;
- chat de texto y mensaje de error;
- fuentes y búsquedas;
- PWA y Service Worker;
- carga multimedia con un archivo pequeño autorizado;
- headers de seguridad;
- que la zona adulta no sea visible sin aprobación;
- que ningún secreto aparezca en el código del navegador.

## B. Configuración de Discord

### 1. Preparar el bot propio

En Discord Developer Portal:

1. Activa **Server Members Intent** y **Message Content Intent**.
2. Invita el bot con View Channels, Send Messages, Read Message History, Embed Links, Manage Channels, Manage Roles y Manage Messages.
3. No concedas `Administrator`.
4. Coloca manualmente el rol del bot por encima de los roles comunitarios que administrará y debajo de `👑 Fundador`.
5. Guarda `DISCORD_TOKEN` y `GUILD_ID` únicamente en `.env` local.

### 2. Sincronizar estructura

```powershell
npm install
node setup-chongseb.js
```

Sin `--rebuild`, el script sincroniza sin borrar todo. Usa `--rebuild` solo con respaldo y después de escribir la confirmación exacta solicitada en consola.

### 3. Panel de la Nutria

En cualquier canal de texto, un miembro con el rol exacto `👑 Fundador` ejecuta:

```text
!nutria-control
```

El botón de estadísticas muestra miembros y canales. Los botones de roles y canales están preparados para una implementación posterior. El botón administrativo explica que `Administrator` debe otorgarlo manualmente el propietario; el panel no concede ese permiso, no desactiva la verificación adulta y no evita la jerarquía de Discord.

### 4. Bots públicos

Sigue `discord/DISCORD_README.md`:

1. MEE6 para XP.
2. Ticket Tool para soporte privado.
3. Sapphire para automatizar roles después de revisión del staff.

OAuth o una pregunta no prueban edad. Mantén canales adultos como restringidos/NSFW y el rol adulto bajo control humano.

### 5. Bot musical

```powershell
cd music-bot
npm install
npm start
```

Para producción usa el `Dockerfile` y un proveedor que mantenga procesos persistentes y WebSockets. Configura el token como secreto. Los planes de Railway, Replit y Heroku pueden cambiar; confirma disponibilidad y precio.

### 6. Prueba final de Discord

Usa una cuenta secundaria:

- miembro nuevo solo ve canales públicos;
- miembro sin aprobar no ve la zona adulta;
- tickets son privados;
- MEE6 no da XP en canales excluidos;
- el DJ solo responde en el canal previsto y exige estar en voz;
- `!nutria-control` rechaza usuarios sin el rol exacto `👑 Fundador`.

## C. Criterio de “lanzamiento completado”

El lanzamiento termina únicamente cuando:

- GitHub Actions está verde;
- Netlify muestra deploy publicado;
- el dominio final responde por HTTPS;
- chat, almacenamiento y pagos de prueba funcionan;
- los webhooks se verifican;
- Discord conserva las restricciones privadas;
- no hay secretos en Git ni logs públicos.
