# Manual del Albañil para el Discord de CHONGSEB

Este manual instala la estructura del servidor, tres bots públicos y el DJ autoalojado. Usa únicamente enlaces oficiales, activa 2FA en las cuentas de administración y evita conceder `Administrator` cuando no sea imprescindible.

## Orden recomendado

1. Ejecutar `setup-chongseb.js` desde una PC segura.
2. Revisar categorías, canales, roles y permisos creados.
3. Instalar MEE6 y configurar XP.
4. Instalar Ticket Tool y crear el panel de soporte.
5. Instalar Sapphire para automatizar roles después del proceso de moderación.
6. Desplegar `music-bot/` como proceso persistente.
7. Probar todo con una cuenta secundaria sin permisos.

## 1. Crear la estructura CHONGSEB

Desde la raíz del repositorio:

```powershell
npm install
node setup-chongseb.js
```

El script usa `DISCORD_TOKEN` y, opcionalmente, `GUILD_ID` desde `.env`. No compartas el token. El script puede reconstruir recursos cuando se usa su modo destructivo; lee la confirmación mostrada en consola antes de aceptarla.

Al terminar deben existir, entre otros:

- `#🌍-chongseb-global`
- `#🇲🇽-zocalo-chill`
- `#🌷-grachten-cafe`
- `#🦦-nutria-cósmica-boat`
- `#🛠️-soporte-y-ayuda`
- `#🔐-verificacion-de-edad`
- `#🎵-musica`

## 2. MEE6 — niveles y XP

- Sitio e instalación oficial: [MEE6 Dashboard](https://mee6.xyz/dashboard/)
- Ayuda oficial: [Getting Started with MEE6](https://help.mee6.xyz/support/solutions/articles/101000385394-getting-started-with-mee6)

### Instalación

1. Abre el dashboard oficial e inicia sesión con Discord.
2. Pulsa **Setup** en el servidor CHONGSEB y autoriza MEE6.
3. En Discord, mueve el rol de MEE6 por encima de los roles que deba entregar.
4. En el dashboard activa **Levels**.
5. Incluye solamente estos canales:
   - `#🌍-chongseb-global`
   - `#🇲🇽-zocalo-chill`
   - `#🌷-grachten-cafe`
   - `#🦦-nutria-cósmica-boat`
6. Excluye anuncios, soporte, verificación, canales privados y música para reducir abuso de XP.
7. Activa enfriamiento y medidas anti-spam disponibles.

### Recompensas sugeridas

| Nivel | Rol sugerido | Observación |
|---:|---|---|
| 5 | `🧒 Explorador Infantil` | Úsalo solo como insignia comunitaria; no concede acceso infantil ni demuestra edad. |
| 10 | `🌍 CHONGSEB Legend` | Reconocimiento por participación. |
| 20 | `🏛️ Veterano` | Opcional; el script propio también evalúa antigüedad, así que evita reglas duplicadas. |

La disponibilidad de recompensas automáticas puede depender del plan vigente de MEE6. Compruébalo en el dashboard antes de diseñar la jerarquía.

### Permisos mínimos

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Manage Roles, únicamente si entregará roles

No concedas `Administrator`. MEE6 solo puede asignar roles situados debajo de su propio rol.

## 3. Ticket Tool — soporte privado

- Sitio e instalación oficial: [Ticket Tool](https://tickettool.xyz/)
- Dashboard oficial: [Ticket Tool Dashboard](https://tickettool.xyz/dashboard)

### Instalación

1. Abre el sitio oficial y usa **Invite/Login** para añadir el bot a CHONGSEB.
2. Autoriza únicamente el servidor correcto.
3. Abre el dashboard y crea un panel llamado **Soporte CHONGSEB**.
4. Publica el panel en `#🛠️-soporte-y-ayuda`.
5. Configura la categoría donde se crearán tickets privados; usa una categoría dedicada, por ejemplo `🎫 TICKETS PRIVADOS`.
6. Concede acceso dentro de cada ticket al solicitante, `👑 Fundador` y `🛡️ Moderador`.
7. Configura el mensaje:

> Cuéntanos tu problema, el equipo de la nutria te atenderá pronto.

8. Activa cierre, transcripción y registro solamente si tienes una política de privacidad y retención. No publiques transcripciones en canales públicos.

### Permisos mínimos

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files
- Manage Channels
- Manage Roles, solo si el flujo de tickets lo necesita

No permitas que el bot vea `🔞 CLUB SECRETO` ni otras categorías privadas salvo que realmente atienda tickets allí.

## 4. Sapphire — automatización de roles

- Sitio e instalación oficial: [Sapphire](https://sapph.xyz/)
- Invitación oficial: abre [Sapphire](https://sapph.xyz/) y pulsa **Add to Discord**
- Dashboard oficial: [Sapphire Dashboard](https://sapph.xyz/dashboard)

### Advertencia sobre edad

Discord OAuth2, un botón o una pregunta de “¿eres mayor de edad?” **no verifican identidad ni edad**. Sapphire puede automatizar la entrega de un rol después de una decisión del staff, pero no debe presentarse como Face ID ni verificación legal.

Para proteger la zona adulta:

1. Mantén `🔞 CLUB SECRETO` invisible para `@everyone`.
2. Marca los canales correspondientes como **Age-Restricted/NSFW** en Discord.
3. Publica las reglas y el proceso en `#🔐-verificacion-de-edad`.
4. Recopila la mínima información posible; no pidas documentos en mensajes o canales de Discord.
5. Haz que un moderador autorizado apruebe el acceso según la política y legislación aplicables.
6. Después de aprobar, usa Sapphire para entregar `🔞 Adulto Verificado` mediante una acción restringida al staff.
7. Configura el mensaje privado:

> ¡Verificación completada! Ya puedes ver la zona 🔞.

8. Prueba con una cuenta sin rol que la categoría permanezca invisible.

### Permisos mínimos

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Manage Roles

Coloca el rol de Sapphire por encima de `🔞 Adulto Verificado`, pero debajo de `🛡️ Moderador` y `👑 Fundador`. No permitas una reacción o botón público que entregue directamente el rol adulto.

## 5. DJ CHONGSEB — bot de música autoalojado

- Código del bot: [music-bot en Nutria96/newworld](https://github.com/Nutria96/newworld/tree/main/music-bot)
- Manual local: [`music-bot/README.md`](../music-bot/README.md)

El bot se ejecuta por separado:

```powershell
cd music-bot
npm install
npm start
```

Configura `DISCORD_TOKEN` como secreto del proveedor. Requiere un proceso persistente con WebSocket y audio; no funciona como Netlify Function. Railway, Replit, Heroku y otros proveedores cambian sus planes y límites, así que confirma disponibilidad y precio antes de desplegar.

Permisos del bot:

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Connect
- Speak

Canal de comandos: `#🎵-musica`.

Comandos:

- `!play <URL o búsqueda>`
- `!search <texto>`
- `!skip`
- `!stop`
- `!pause`
- `!resume`
- `!queue`
- `!volume <0-100>`
- `!nowplaying`
- `!remove <número>`
- `!loop`
- `!music help`

## 6. Revisión final

## Panel seguro de la Nutria

El comando `!charly-control` puede ejecutarse por `👑 Fundador` o `🛡️ Moderador` dentro de `#🏛️-new-amsterdam` o la Sala de Máquinas. Muestra el estado operativo y asigna al bot el rol visual `🌍 Maestro de Ámsterdam`, que no contiene permisos administrativos.

El comando deliberadamente:

- no concede `Administrator`;
- no promueve el rol por encima de la jerarquía permitida por Discord;
- no usa `member.roles.set`, por lo que no elimina roles gestionados;
- no pausa ni evita la verificación de edad;
- no abre el club adulto.

Para instalar y ordenar canales, invita el bot propio con **Manage Channels**, **Manage Roles**, **Manage Messages**, **View Channels**, **Send Messages**, **Read Message History** y **Embed Links**. Coloca manualmente su rol por encima de los roles comunitarios que deba gestionar, pero por debajo de `👑 Fundador`. No se recomienda `Administrator`.

### `!nutria-control`

Un miembro con el rol exacto `👑 Fundador` puede ejecutar `!nutria-control` en cualquier canal de texto. El embed ofrece cuatro botones:

- 🔧 Gestionar roles: función preparada para una implementación posterior;
- 📂 Gestionar canales: función preparada para una implementación posterior;
- 👑 Dar permisos de admin: informa que el propietario debe hacerlo manualmente;
- 📊 Estadísticas: muestra miembros, usuarios, bots, roles y canales.

Los botones responden de forma privada al Fundador. El panel no crea roles administrativos, no altera canales y no asigna `Administrator`. Las mutaciones sensibles se realizan manualmente desde Discord para conservar confirmación, historial y control del propietario. Si otra persona intenta invocarlo, recibe: `❌ Solo el fundador puede invocar el control de la nutria.`

Prueba con tres perfiles:

1. Miembro nuevo: solo ve áreas públicas.
2. Miembro adulto sin aprobar: no ve el club secreto.
3. Moderador: puede atender tickets y aprobar roles sin tener que otorgar `Administrator` a bots.

Revisa también:

- Los bots están por encima únicamente de los roles que necesitan gestionar.
- Ningún bot tiene acceso global a categorías privadas.
- Los canales de anuncios y normas mantienen escritura limitada.
- Los tickets son privados.
- El rol adulto no puede autoasignarse.
- Los tokens no aparecen en Git, mensajes, capturas ni archivos de soporte.

## Enlaces oficiales resumidos

- [Instalar/configurar MEE6](https://mee6.xyz/dashboard/)
- [Instalar/configurar Ticket Tool](https://tickettool.xyz/dashboard)
- [Instalar/configurar Sapphire](https://sapph.xyz/)
