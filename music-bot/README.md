# DJ CHONGSEB

Bot de música separado del configurador del servidor. Mantiene una cola por servidor, volumen, bucle y desconexión automática.

## Fuentes y límites

- YouTube: pistas, búsqueda y playlists.
- SoundCloud: pistas y playlists cuando la URL es accesible.
- Spotify: obtiene metadatos y busca una versión equivalente reproducible; Spotify no entrega su audio al bot.
- URL directa: solamente si responde con un tipo `audio/*`.
- Twitch, Bandcamp, contenido con DRM, privado, regionalmente bloqueado o protegido no se presenta como compatible.
- Máximo 50 pistas importadas por playlist y 200 en cola.

Respeta derechos de autor, condiciones de las plataformas y permisos del propietario. La disponibilidad de extractores puede cambiar cuando una plataforma modifica su servicio.

## Discord

1. Crea una aplicación y un bot en el Discord Developer Portal.
2. Activa **Message Content Intent**.
3. Invítalo con: Ver canales, Enviar mensajes, Insertar enlaces, Conectar y Hablar.
4. Copia `.env.example` como `.env` y pega `DISCORD_TOKEN`. Nunca publiques `.env`.

## Ejecutar

```powershell
cd music-bot
npm install
npm start
```

Requiere Node.js 20 o posterior. Si no usas el `Dockerfile`, instala FFmpeg en el sistema.

## Desplegar

Usa un servicio que permita procesos persistentes y conexiones de voz/WebSocket. Replit, Railway, Heroku y otros cambian sus planes; verifica límites y precios actuales. No es una función Netlify.

Con Docker:

```powershell
docker build -t chongseb-music .
docker run --env-file .env chongseb-music
```

Configura el comando de inicio como `npm start`, el directorio raíz como `music-bot/` y añade `DISCORD_TOKEN` mediante secretos del proveedor.

## Comandos

`!play`, `!search`, `!skip`, `!stop`, `!pause`, `!resume`, `!queue`, `!volume`, `!nowplaying`, `!remove`, `!loop` y `!music help`.
