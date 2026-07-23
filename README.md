# Configuración automática del Discord de CHONGSEB

Este proyecto usa Discord.js v14 para crear y mantener la estructura del
servidor CHONGSEB.

## 1. Crear el bot

1. Entra a Discord Developer Portal.
2. Crea una aplicación y agrega un bot.
3. En **Bot → Privileged Gateway Intents**, activa:
   - Server Members Intent.
   - Message Content Intent.
4. Invita el bot al servidor con estos permisos:
   - Manage Channels.
   - Manage Roles.
   - Manage Messages.
   - Send Messages.
   - Embed Links.
5. Coloca el rol del bot por encima de todos los roles que administrará.

Nunca publiques ni compartas el token del bot.

## 2. Instalar dependencias

```powershell
cd "C:\Users\Usuario\Documents\Codex\2026-07-14\proyecto-nasa-de-chong-gobierno-de\outputs\CHONGSEB_AUTO_BOSS"
npm install
```

También puede hacerse explícitamente:

```powershell
npm install discord.js dotenv
```

## 3. Configurar `.env`

```powershell
Copy-Item .env.example .env
```

Edita `.env`:

```dotenv
DISCORD_TOKEN=PEGA_AQUI_EL_TOKEN_REAL
GUILD_ID=ID_DEL_SERVIDOR
DISCORD_COMMAND_PREFIX=!
```

`GUILD_ID` puede omitirse únicamente cuando el bot pertenece a un solo
servidor.

## 4. Reconstrucción total inicial

Este comando elimina todos los canales y roles que Discord permita borrar:

```powershell
node setup-chongseb.js --rebuild
```

Equivalente:

```powershell
npm run discord:rebuild
```

El script no borrará nada hasta que escribas:

```text
RECONSTRUIR Nombre exacto del servidor
```

Los roles administrados por Discord, el rol `@everyone` y el rol del bot se
conservan.

## 5. Inicio normal

Después de la reconstrucción, inicia el bot sin el parámetro destructivo:

```powershell
node setup-chongseb.js
```

También puedes usar:

```powershell
npm run discord:chongseb
```

Mantén el proceso activo para recibir nuevos miembros, enviar el embed de
bienvenida, atender comandos y revisar Veteranos cada 24 horas.

## Comandos

- `!add-chapiza @usuario`
- `!add-juez @usuario`
- `!check-veteranos`
- `!premium` — solicita revisión manual; no concede el rol automáticamente.

Los tres comandos administrativos solo funcionan para Fundador, Moderador o
administradores.

## Recursos visuales opcionales

```dotenv
DISCORD_ICON_PATH=C:\ruta\icono.png
DISCORD_BANNER_PATH=C:\ruta\banner.png
DISCORD_WELCOME_IMAGE_URL=https://dominio.example/nutria.png
```

El banner depende del nivel de mejoras disponible en el servidor.
# Búsqueda universal segura

El chat consulta SerpAPI solamente cuando el mensaje solicita enlaces, fuentes, recursos o información actual. Configura `SERPAPI_KEY` en Netlify para **Production** y **Deploy Previews**. Las fuentes reales se construyen exclusivamente con URLs devueltas por la búsqueda; el modelo no puede introducir enlaces como fuentes por su cuenta.

Cuando no hay resultados, la IA puede ofrecer recursos explicativos sin URL. La interfaz los etiqueta como contenido generado por IA y aclara que no son fuentes publicadas. El chat adulto conserva autenticación, aprobación y filtros. La zona infantil actual no contiene chat ni búsqueda externa.

## Publicación verificada

El script se niega a publicar si la carpeta no es un repositorio Git, si `origin` no apunta a `Nutria96/newworld` o si la rama activa no es `main`.

```powershell
node push-to-github.js --confirm-main
```

Sin `--confirm-main` no modifica Git. Si no existen cambios, termina correctamente sin crear un commit vacío.
