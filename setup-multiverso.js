"use strict";

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID?.trim();
const DAY_MS = 86_400_000;

if (!TOKEN) {
  console.error("Falta DISCORD_TOKEN en .env.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const ROLES = [
  ["founder", "👑 Fundador", "#FFD700", [PermissionFlagsBits.Administrator]],
  ["moderator", "🛡️ Moderador", "#00FFFF", [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ModerateMembers,
  ]],
  ["legend", "🌍 CHONGSEB Legend", "#FF00FF", []],
  ["premium", "💎 Premium", "#FF8C00", []],
  ["adult", "🔞 Adulto Verificado", "#FF69B4", []],
  ["child", "🧒 Explorador Infantil", "#00FF7F", []],
  ["otter", "🦦 La Nutria", "#9B59B6", []],
  ["veteran", "🏛️ Veterano", "#123A73", []],
  ["chapiza", "✨ La Chapiza", "#FFE14D", []],
  ["tacologist", "🌮 Tacólogo", "#F05A28", []],
  ["canals", "🇳🇱 Canales", "#21468B", []],
  ["mystic", "🎇 Místico", "#A855F7", []],
];

const WELCOME_MARKER = "MULTIVERSO CHONGSEB";
const WELCOME = `🌌 **¡BIENVENIDO AL MULTIVERSO CHONGSEB!** 🦦

Aquí el Zócalo se encuentra con los canales de Ámsterdam. Explora las categorías y descubre todos los escenarios.

🇲🇽🌷 **El Portal Cultural:** charla, comida, arte y celebraciones.
🌊 **El Canal de la Nutria:** naturaleza, creatividad y juegos.
🔞 **Club Secreto:** disponible únicamente después de la verificación de edad.
🧒 **Zona Infantil:** misiones de naturaleza en un espacio separado y familiar.
🛠️ **Sala de Máquinas:** soporte y tienda Premium.

Cuida la privacidad de los demás, acredita el arte que compartas y mantén el contenido adulto exclusivamente dentro del club verificado.

\`${WELCOME_MARKER}\``;

function normalized(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("es-MX");
}

async function getGuild() {
  if (GUILD_ID) return client.guilds.fetch(GUILD_ID);
  const guilds = await client.guilds.fetch();
  if (guilds.size !== 1) {
    throw new Error("Define GUILD_ID cuando el bot pertenezca a más de un servidor.");
  }
  return guilds.first().fetch();
}

async function ensureRole(guild, [key, name, color, permissions]) {
  const roles = await guild.roles.fetch();
  let role = roles.find(item => normalized(item.name) === normalized(name));
  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      permissions,
      reason: "Multiverso México-Ámsterdam",
    });
  } else if (role.editable) {
    await role.edit({ color, reason: "Sincronización del multiverso" });
  }
  return [key, role];
}

async function ensureCategory(guild, name, permissionOverwrites) {
  const channels = await guild.channels.fetch();
  let item = channels.find(channel =>
    channel.type === ChannelType.GuildCategory &&
    normalized(channel.name) === normalized(name),
  );
  if (!item) {
    item = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
      reason: "Multiverso México-Ámsterdam",
    });
  } else {
    await item.edit({
      permissionOverwrites,
      reason: "Sincronización del multiverso",
    });
  }
  return item;
}

async function ensureText(guild, parent, name, topic, permissionOverwrites = null) {
  const channels = await guild.channels.fetch();
  let item = channels.find(channel =>
    channel.type === ChannelType.GuildText &&
    normalized(channel.name) === normalized(name),
  );
  const options = {
    name,
    parent: parent.id,
    topic,
    reason: "Multiverso México-Ámsterdam",
  };
  if (permissionOverwrites) options.permissionOverwrites = permissionOverwrites;
  if (!item) {
    item = await guild.channels.create({ ...options, type: ChannelType.GuildText });
  } else {
    await item.edit(options);
  }
  if (!permissionOverwrites) await item.lockPermissions();
  return item;
}

function overwrite(id, allow = [], deny = []) {
  return { id, allow, deny };
}

async function installAssets(guild) {
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  const icon = process.env.DISCORD_ICON_PATH?.trim();
  const banner = process.env.DISCORD_BANNER_PATH?.trim();
  if (icon && fs.existsSync(icon)) await guild.setIcon(icon, "Icono del multiverso");
  if (banner && fs.existsSync(banner)) {
    await guild.setBanner(banner, "Banner del multiverso").catch(error => {
      console.warn(`Banner omitido: ${error.message}`);
    });
  }

  const emojiDirectory = process.env.DISCORD_EMOJI_DIR?.trim();
  if (!emojiDirectory || !fs.existsSync(emojiDirectory)) return;
  const emojiNames = ["taco_chill", "canal_amsterdam", "mexico_flag", "netherlands_flag"];
  const existing = await guild.emojis.fetch();
  for (const name of emojiNames) {
    if (existing.some(emoji => emoji.name === name)) continue;
    const filename = [".png", ".jpg", ".webp"]
      .map(extension => path.join(emojiDirectory, `${name}${extension}`))
      .find(fs.existsSync);
    if (filename) {
      await guild.emojis.create({ attachment: filename, name }).catch(error => {
        console.warn(`Emoji ${name} omitido: ${error.message}`);
      });
    }
  }
}

async function assignVeterans(guild, role) {
  const members = await guild.members.fetch();
  let assigned = 0;
  for (const member of members.values()) {
    const oldEnough =
      !member.user.bot &&
      member.joinedTimestamp &&
      Date.now() - member.joinedTimestamp >= 30 * DAY_MS;
    if (!oldEnough || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, "30 días en el multiverso CHONGSEB");
      assigned += 1;
    } catch (error) {
      console.warn(`Veterano omitido (${member.user.tag}): ${error.message}`);
    }
  }
  return assigned;
}

async function pinWelcome(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  let message = messages.find(item =>
    item.author.id === client.user.id && item.content.includes(WELCOME_MARKER),
  );
  if (message) await message.edit(WELCOME);
  else message = await channel.send(WELCOME);
  if (!message.pinned) await message.pin("Recorrido oficial del multiverso");
}

async function install(guild) {
  const me = await guild.members.fetchMe();
  const required = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageMessages,
  ];
  if (!me.permissions.has(required)) {
    throw new Error("El bot necesita Manage Channels, Manage Roles y Manage Messages.");
  }

  const roleEntries = [];
  for (const specification of ROLES) roleEntries.push(await ensureRole(guild, specification));
  const roles = Object.fromEntries(roleEntries);
  const everyone = guild.roles.everyone.id;
  const view = PermissionFlagsBits.ViewChannel;
  const send = PermissionFlagsBits.SendMessages;
  const publicAccess = [overwrite(everyone, [view])];
  const staff = [roles.founder.id, roles.moderator.id];
  const staffAllows = staff.map(id => overwrite(id, [view, send]));
  const adultAccess = [
    overwrite(everyone, [], [view]),
    overwrite(roles.adult.id, [view, send]),
    overwrite(roles.premium.id, [view, send]),
    overwrite(roles.legend.id, [view, send]),
    ...staffAllows,
  ];

  const portal = await ensureCategory(guild, "🇲🇽🌷 EL PORTAL CULTURAL", publicAccess);
  const welcome = await ensureText(
    guild,
    portal,
    "👋-bienvenida-al-multiverso",
    "Recorrido inicial y normas del multiverso CHONGSEB.",
  );
  await ensureText(guild, portal, "🇲🇽-zocalo-chill", "Charla general inspirada en el Zócalo.");
  await ensureText(guild, portal, "🌷-grachten-cafe", "Conversación general inspirada en los canales de Ámsterdam.");
  await ensureText(guild, portal, "🍔-puestos-de-comida", "Recetas y cultura gastronómica mexicana y neerlandesa.");
  await ensureText(guild, portal, "🎨-arte-xochimilco-rijksmuseum", "Arte, fotografía y diseño con crédito a sus autores.");
  await ensureText(guild, portal, "🎭-dia-de-muertos-x-keukenhof", "Eventos y celebraciones culturales con respeto.");

  const otter = await ensureCategory(guild, "🌊 EL CANAL DE LA NUTRIA", publicAccess);
  await ensureText(guild, otter, "🦦-nutria-cosmica-boat", "Viajes creativos entre Xochimilco y los canales.");
  await ensureText(
    guild,
    otter,
    "🌿-jardines-secretos",
    "Naturaleza, plantas y herbolaria. El contenido sobre cannabis pertenece exclusivamente al club adulto.",
  );
  await ensureText(guild, otter, "🎮-juegos-mexico-amsterdam", "Juegos, geoide y experiencias interactivas.");

  const secret = await ensureCategory(guild, "🔞 CLUB SECRETO", adultAccess);
  await ensureText(
    guild,
    secret,
    "🔐-verificacion-de-edad",
    "Solicitud privada de verificación. No publiques identificaciones en canales públicos.",
    [
      overwrite(everyone, [view, send]),
      overwrite(roles.adult.id, [view, send]),
      ...staffAllows,
    ],
  );
  await ensureText(guild, secret, "💋-noche-de-los-canales", "Espacio nocturno exclusivo para adultos verificados.");
  await ensureText(guild, secret, "💸-ofertas-tulipanes", "Ofertas identificadas claramente y enlaces revisados.", adultAccess);

  const kids = await ensureCategory(guild, "🧒 ZONA INFANTIL", publicAccess);
  await ensureText(guild, kids, "🧒-ninos-xochimilco", "Misiones familiares sobre chinampas, limpieza y naturaleza.");
  await ensureText(guild, kids, "🎨-dibujos-de-los-peques", "Arte familiar. No compartas datos personales ni rostros sin autorización adulta.");

  const machines = await ensureCategory(guild, "🛠️ LA SALA DE MÁQUINAS", publicAccess);
  await ensureText(guild, machines, "🛠️-soporte-y-ayuda", "Soporte técnico y ayuda de la comunidad.");
  await ensureText(guild, machines, "💸-tienda-premium", "Planes y productos oficiales de CHONGSEB.");

  await pinWelcome(welcome);
  await installAssets(guild);
  return assignVeterans(guild, roles.veteran);
}

client.once("ready", async () => {
  try {
    const guild = await getGuild();
    const assigned = await install(guild);
    console.log(`✅ Multiverso instalado en ${guild.name}. Veteranos nuevos: ${assigned}.`);
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
