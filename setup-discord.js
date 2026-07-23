"use strict";

require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID?.trim();
const REBUILD = process.argv.includes("--rebuild");

if (!TOKEN) {
  console.error("Falta DISCORD_TOKEN. Cópialo en .env; nunca lo pegues dentro del código.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const ROLE_DEFINITIONS = [
  {
    key: "founder",
    name: "👑 Fundador",
    color: "#FFD700",
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    key: "moderator",
    name: "🛡️ Moderador",
    color: "#00FFFF",
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ViewAuditLog,
    ],
  },
  {
    key: "legend",
    name: "🌍 CHONGSEB Legend",
    color: "#FF00FF",
    permissions: [],
  },
  {
    key: "premium",
    name: "💎 Premium",
    color: "#FF8C00",
    permissions: [],
  },
  {
    key: "adult",
    name: "🔞 Adulto Verificado",
    color: "#FF69B4",
    permissions: [],
  },
  {
    key: "child",
    name: "🧒 Explorador Infantil",
    color: "#00FF7F",
    permissions: [],
  },
  {
    key: "otter",
    name: "🦦 La Nutria",
    color: "#9B59B6",
    permissions: [],
  },
];

const WELCOME = `🦦 **¡BIENVENIDO A LA CASA DE LA NUTRIA CÓSMICA!** 🌌

Has aterrizado en el servidor oficial de CHONGSEB. Aquí no solo somos una página, somos una comunidad.

🔹 **¿Qué encontrarás aquí?**
- 🌍 Charla global sobre diseño, inteligencia artificial y tecnología.
- 🎮 Minijuegos y anuncios interactivos para ganar XP.
- 🔞 Un club exclusivo para adultos (previa verificación de edad).
- 🧒 Zona infantil con misiones de limpieza y naturaleza.

📜 **Normas básicas:**
1. Respeta a los demás. El buen rollo manda.
2. No publiques contenido explícito fuera de la zona adulta.
3. Para acceder a la zona adulta, ve a \`#🔐-verificacion-de-edad\`.

🚀 **Activa tu rol premium:**
Si ya eres suscriptor de CHONGSEB, escribe !premium y el equipo verificará tu cuenta antes de asignar el rol.

¡Nos vemos en los canales, albañil! 🦦✨`;

function overwrite(id, allow = [], deny = []) {
  return { id, allow, deny };
}

async function chooseGuild() {
  if (GUILD_ID) {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) throw new Error("GUILD_ID no corresponde a un servidor accesible para el bot.");
    return guild;
  }
  const guilds = await client.guilds.fetch();
  if (guilds.size !== 1) {
    throw new Error("Define GUILD_ID cuando el bot pertenezca a cero o a más de un servidor.");
  }
  return guilds.first().fetch();
}

async function assertBotPermissions(guild) {
  const me = await guild.members.fetchMe();
  const required = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageMessages,
  ];
  if (!me.permissions.has(required)) {
    throw new Error("El bot necesita Manage Channels, Manage Roles y Manage Messages.");
  }
}

async function destructiveConfirmation(guild) {
  if (!REBUILD) {
    throw new Error("Modo seguro activo. Ejecuta `node setup-discord.js --rebuild` para reconstruir.");
  }
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const expected = `RECONSTRUIR ${guild.name}`;
  const answer = await prompt.question(
    `\nEsto eliminará todos los canales y todos los roles eliminables de “${guild.name}”.\nEscribe exactamente: ${expected}\n> `,
  );
  prompt.close();
  if (answer.trim() !== expected) throw new Error("Confirmación cancelada; no se modificó el servidor.");
}

async function clearGuild(guild) {
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (channel?.deletable) await channel.delete("Reconstrucción autorizada de CHONGSEB");
  }

  const roles = await guild.roles.fetch();
  const deletable = [...roles.values()]
    .filter(role => role.id !== guild.id && !role.managed && role.editable)
    .sort((a, b) => a.position - b.position);
  for (const role of deletable) {
    await role.delete("Reconstrucción autorizada de CHONGSEB");
  }
}

async function createRoles(guild) {
  const roles = {};
  // Discord inserta roles nuevos por debajo del bot. Se crean de menor a mayor
  // y después se solicita el orden final dentro del rango administrable.
  for (const definition of [...ROLE_DEFINITIONS].reverse()) {
    roles[definition.key] = await guild.roles.create({
      name: definition.name,
      color: definition.color,
      permissions: definition.permissions,
      reason: "Arquitectura CHONGSEB",
    });
  }
  const ordered = ROLE_DEFINITIONS
    .map((definition, index) => ({
      role: roles[definition.key].id,
      position: ROLE_DEFINITIONS.length - index,
    }));
  await guild.roles.setPositions(ordered).catch(() => {
    console.warn("No se pudo ajustar toda la jerarquía. Coloca el rol del bot sobre los roles administrados.");
  });
  return roles;
}

async function category(guild, name, permissions) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: permissions,
    reason: "Arquitectura CHONGSEB",
  });
}

async function text(guild, parent, name, permissions = []) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent.id,
    permissionOverwrites: permissions,
    reason: "Arquitectura CHONGSEB",
  });
}

async function createArchitecture(guild, roles) {
  const everyone = guild.roles.everyone.id;
  const view = PermissionFlagsBits.ViewChannel;
  const send = PermissionFlagsBits.SendMessages;
  const staffView = [
    overwrite(roles.founder.id, [view, send]),
    overwrite(roles.moderator.id, [view, send]),
  ];
  const publicPermissions = [overwrite(everyone, [view])];

  const emperor = await category(guild, "📢 EL EMPERADOR", publicPermissions);
  await text(guild, emperor, "📜-normas", [
    overwrite(everyone, [view], [send]),
    ...staffView,
  ]);
  await text(guild, emperor, "📢-anuncios", [
    overwrite(everyone, [view], [send]),
    ...staffView,
  ]);
  const welcome = await text(guild, emperor, "👋-bienvenida-y-presentaciones");

  const kingdom = await category(guild, "🦦 EL REINO DE LA NUTRIA", publicPermissions);
  await text(guild, kingdom, "🌍-chongseb-global");
  await text(guild, kingdom, "🖼️-arte-y-disenos");
  await text(guild, kingdom, "🎮-minijuegos-ads");

  const adultCategoryPermissions = [
    overwrite(everyone, [], [view]),
    overwrite(roles.adult.id, [view]),
    overwrite(roles.premium.id, [view]),
    overwrite(roles.legend.id, [view]),
    ...staffView,
  ];
  const secret = await category(guild, "🔞 CLUB SECRETO", adultCategoryPermissions);
  // Es el único canal del club visible antes de la verificación para que el
  // usuario pueda solicitarla. No expone el resto de la categoría.
  await text(guild, secret, "🔐-verificacion-de-edad", [
    overwrite(everyone, [view, send]),
    overwrite(roles.adult.id, [view, send]),
    ...staffView,
  ]);
  await text(guild, secret, "💋-el-mundo-adulto");
  await text(guild, secret, "💸-ofertas-para-adultos", [
    overwrite(everyone, [], [view]),
    overwrite(roles.adult.id, [], [view]),
    overwrite(roles.premium.id, [view]),
    overwrite(roles.legend.id, [view]),
    ...staffView,
  ]);

  const kids = await category(guild, "🧒 LA ZONA INFANTIL", publicPermissions);
  await text(guild, kids, "🧒-misiones-infantiles");
  await text(guild, kids, "🎨-dibujos-de-los-peques");

  const support = await category(guild, "🛠️ LA SALA DE MÁQUINAS", publicPermissions);
  await text(guild, support, "🛠️-soporte-y-ayuda");
  await text(guild, support, "💸-tienda-premium");

  const message = await welcome.send(WELCOME);
  await message.pin("Mensaje oficial de bienvenida");
  return welcome;
}

client.once("ready", async () => {
  try {
    const guild = await chooseGuild();
    await assertBotPermissions(guild);
    await destructiveConfirmation(guild);
    console.log(`Reconstruyendo: ${guild.name}`);
    await clearGuild(guild);
    const roles = await createRoles(guild);
    const welcome = await createArchitecture(guild, roles);
    console.log(`✅ Servidor reconstruido. Bienvenida: https://discord.com/channels/${guild.id}/${welcome.id}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(TOKEN).catch(error => {
  console.error(`No se pudo autenticar el bot: ${error.message}`);
  process.exit(1);
});
