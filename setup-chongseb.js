"use strict";

require("dotenv").config();

const fs = require("node:fs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const {
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID?.trim();
const PREFIX = process.env.DISCORD_COMMAND_PREFIX || "!";
const REBUILD = process.argv.includes("--rebuild");
const DAY_MS = 86_400_000;
const STAFF_NAMES = new Set(["👑 Fundador", "🛡️ Moderador"]);
const controlCommand = require("./commands/control");
const nutriaControl = require("./commands/nutria-control");

if (!TOKEN) {
  console.error("Falta DISCORD_TOKEN en .env.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ROLE_SPECS = [
  ["founder", "👑 Fundador", "#FFD700", [PermissionFlagsBits.Administrator]],
  ["moderator", "🛡️ Moderador", "#00FFFF", [PermissionFlagsBits.Administrator]],
  ["legend", "🌍 CHONGSEB Legend", "#FF00FF", []],
  ["premium", "💎 Premium", "#FF8C00", []],
  ["adult", "🔞 Adulto Verificado", "#FF69B4", []],
  ["child", "🧒 Explorador Infantil", "#00FF7F", []],
  ["otter", "🦦 La Nutria", "#9B59B6", []],
  ["judge", "⚖️ Juez", "#FF0000", []],
  ["veteran", "🏛️ Veterano", "#2E86C1", []],
  ["tacologist", "🌮 Tacólogo", "#F39C12", []],
  ["canals", "🇳🇱 Canales", "#1ABC9C", []],
  ["mystic", "🎇 Místico", "#8E44AD", []],
  ["chapiza", "🔰 La Chapiza", "#FFD700", []],
  ["master", "🌍 Maestro de Ámsterdam", "#FFD700", []],
];

const WELCOME_MARKER = "CHONGSEB_MULTIVERSE_WELCOME";
const WELCOME = `🦦 **¡BIENVENIDO AL MULTIVERSO CHONGSEB!** 🌌

Has aterrizado en el punto donde el Zócalo de México se encuentra con los canales de Ámsterdam. Aquí no solo somos una página, somos un viaje cultural.

🔹 **Escenarios que explorarás:**
- 🌍 El Zócalo y los Grachten para charla general.
- 🦦 La Nutria Cósmica navega entre Xochimilco y los tulipanes.
- 🔞 Club secreto para adultos verificados.
- 🧒 Zona infantil con misiones de limpieza y naturaleza.
- ⚖️ Justicia y veteranos con acceso exclusivo.

📜 **Normas básicas:**
1. Respeto total.
2. El contenido adulto permanece exclusivamente en la zona 🔞.
3. Para solicitar acceso adulto, usa \`#🔐-verificacion-de-edad\`.
4. No publiques identificaciones, domicilios ni documentos legales sensibles en canales.

🚀 **Rol Premium:** Si eres suscriptor de CHONGSEB, escribe \`!premium\` para solicitar una verificación manual al equipo.

¡Explora cada rincón y que la nutria te guíe! 🦦✨

\`${WELCOME_MARKER}\``;

function normalized(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("es-MX");
}

function overwrite(id, allow = [], deny = []) {
  return { id, allow, deny };
}

async function targetGuild() {
  if (GUILD_ID) return client.guilds.fetch(GUILD_ID);
  const guilds = await client.guilds.fetch();
  if (guilds.size !== 1) {
    throw new Error("Define GUILD_ID si el bot pertenece a más de un servidor.");
  }
  return guilds.first().fetch();
}

async function confirmRebuild(guild) {
  if (!REBUILD) return false;
  const terminal = readline.createInterface({ input: stdin, output: stdout });
  const expected = `RECONSTRUIR ${guild.name}`;
  const answer = await terminal.question(
    `\n⚠️ Se eliminarán todos los canales y roles eliminables de “${guild.name}”.\n` +
    `Escribe exactamente: ${expected}\n> `,
  );
  terminal.close();
  if (answer.trim() !== expected) {
    throw new Error("Confirmación incorrecta. No se modificó el servidor.");
  }
  return true;
}

async function clearGuild(guild) {
  console.log("🧹 Eliminando canales existentes…");
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel?.deletable) continue;
    console.log(`  - Canal: ${channel.name}`);
    await channel.delete("Reconstrucción CHONGSEB confirmada");
  }

  console.log("🧹 Eliminando roles existentes que Discord permite borrar…");
  const roles = await guild.roles.fetch();
  const deletable = [...roles.values()]
    .filter(role => role.id !== guild.id && !role.managed && role.editable)
    .sort((left, right) => left.position - right.position);
  for (const role of deletable) {
    console.log(`  - Rol: ${role.name}`);
    await role.delete("Reconstrucción CHONGSEB confirmada");
  }
}

async function ensureRole(guild, [key, name, color, permissions]) {
  const collection = await guild.roles.fetch();
  let role = collection.find(item => normalized(item.name) === normalized(name));
  if (!role) {
    console.log(`➕ Creando rol: ${name}`);
    role = await guild.roles.create({
      name,
      color,
      permissions,
      reason: "Instalación integral CHONGSEB",
    });
  } else if (role.editable) {
    // Conserva permisos adicionales configurados manualmente y agrega solo
    // los requeridos por este plano.
    const required = permissions.reduce((value, permission) => value | permission, 0n);
    await role.edit({
      color,
      // El Maestro de Ámsterdam es estrictamente visual: cualquier permiso
      // añadido manualmente se elimina al sincronizar.
      permissions: key === "master" ? required : role.permissions.bitfield | required,
      reason: "Sincronización integral CHONGSEB",
    });
  }
  return [key, role];
}

async function ensureCategory(guild, name, permissionOverwrites) {
  const channels = await guild.channels.fetch();
  let category = channels.find(item =>
    item.type === ChannelType.GuildCategory &&
    normalized(item.name) === normalized(name),
  );
  if (!category) {
    console.log(`➕ Creando categoría: ${name}`);
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
      reason: "Instalación integral CHONGSEB",
    });
  } else {
    await category.edit({
      permissionOverwrites,
      reason: "Sincronización integral CHONGSEB",
    });
  }
  return category;
}

async function ensureText(guild, parent, name, topic, permissionOverwrites) {
  const channels = await guild.channels.fetch();
  let channel = channels.find(item =>
    item.type === ChannelType.GuildText &&
    normalized(item.name) === normalized(name),
  );
  const options = {
    name,
    parent: parent.id,
    topic,
    permissionOverwrites,
    reason: "Instalación integral CHONGSEB",
  };
  if (!channel) channel = await guild.channels.create({ ...options, type: ChannelType.GuildText });
  else await channel.edit(options);
  console.log(`  ✓ Canal: #${name}`);
  return channel;
}

function publicPermissions(guild) {
  return [overwrite(guild.roles.everyone.id, [PermissionFlagsBits.ViewChannel])];
}

function privatePermissions(guild, roleIds) {
  return [
    overwrite(guild.roles.everyone.id, [], [PermissionFlagsBits.ViewChannel]),
    ...roleIds.map(id =>
      overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    ),
  ];
}

function staffIds(roles) {
  return [roles.founder.id, roles.moderator.id];
}

async function assignDefaultOtter(guild, role) {
  const members = await guild.members.fetch();
  let assigned = 0;
  for (const member of members.values()) {
    if (member.user.bot || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, "Rol comunitario predeterminado");
      assigned += 1;
    } catch {}
  }
  return assigned;
}

function eligibleVeteran(member) {
  return (
    !member.user.bot &&
    member.joinedTimestamp &&
    Date.now() - member.joinedTimestamp >= 30 * DAY_MS
  );
}

async function checkVeterans(guild, role) {
  const members = await guild.members.fetch();
  let assigned = 0;
  let skipped = 0;
  for (const member of members.values()) {
    if (!eligibleVeteran(member) || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, "30 días de antigüedad en CHONGSEB");
      assigned += 1;
    } catch {
      skipped += 1;
    }
  }
  return { assigned, skipped };
}

async function configureVisuals(guild) {
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  const icon = process.env.DISCORD_ICON_PATH?.trim();
  const banner = process.env.DISCORD_BANNER_PATH?.trim();
  if (icon && fs.existsSync(icon)) {
    await guild.setIcon(icon, "Icono cyberpunk cultural CHONGSEB");
  }
  if (banner && fs.existsSync(banner)) {
    await guild.setBanner(banner, "Banner cyberpunk cultural CHONGSEB")
      .catch(error => console.warn(`Banner omitido: ${error.message}`));
  }
}

async function pinWelcome(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  let message = messages.find(item =>
    item.author.id === client.user.id && item.content.includes(WELCOME_MARKER),
  );
  if (message) await message.edit(WELCOME);
  else message = await channel.send(WELCOME);
  if (!message.pinned) await message.pin("Bienvenida oficial del multiverso");
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

  const entries = [];
  for (const spec of ROLE_SPECS) entries.push(await ensureRole(guild, spec));
  const roles = Object.fromEntries(entries);
  const staff = staffIds(roles);
  const open = publicPermissions(guild);
  const adult = privatePermissions(guild, [
    roles.adult.id,
    roles.premium.id,
    roles.legend.id,
    ...staff,
  ]);
  const justice = privatePermissions(guild, [
    roles.judge.id,
    roles.veteran.id,
    roles.chapiza.id,
    ...staff,
  ]);

  const portal = await ensureCategory(guild, "🇲🇽🌷 EL PORTAL CULTURAL", open);
  const welcome = await ensureText(guild, portal, "👋-bienvenida-y-presentaciones", "Bienvenida y recorrido del multiverso.", open);
  await ensureText(guild, portal, "🇲🇽-zocalo-chill", "Charla general inspirada en el Zócalo.", open);
  await ensureText(guild, portal, "🌷-grachten-cafe", "Charla inspirada en los canales de Ámsterdam.", open);
  await ensureText(guild, portal, "🍔-puestos-de-comida", "Comida mexicana y neerlandesa.", open);
  await ensureText(guild, portal, "🎨-arte-xochimilco-rijksmuseum", "Arte y diseño con crédito a sus autores.", open);
  await ensureText(guild, portal, "🎭-dia-de-muertos-x-keukenhof", "Eventos culturales respetuosos.", open);

  const canal = await ensureCategory(guild, "🌊 EL CANAL DE LA NUTRIA", open);
  await ensureText(guild, canal, "🦦-nutria-cosmica-boat", "Viajes creativos entre Xochimilco y los canales.", open);
  await ensureText(guild, canal, "🌿-jardines-secretos", "Naturaleza y herbolaria. El contenido regulado pertenece al club adulto.", open);
  await ensureText(guild, canal, "🎮-juegos-mexico-amsterdam", "Juegos y experiencias interactivas.", open);
  await ensureText(guild, canal, "🎵-musica", "Comandos y cola del DJ CHONGSEB. Escribe !music help.", open);

  const secret = await ensureCategory(guild, "🔞 CLUB SECRETO", adult);
  await ensureText(guild, secret, "🔐-verificacion-de-edad", "Solicitud de verificación. No publiques identificaciones en el canal.", [
    overwrite(guild.roles.everyone.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    ...staff.map(id => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])),
  ]);
  await ensureText(guild, secret, "💋-noche-de-los-canales", "Espacio solo para adultos verificados.", adult);
  await ensureText(guild, secret, "💸-ofertas-tulipanes", "Ofertas claramente identificadas y revisadas.", adult);

  const kids = await ensureCategory(guild, "🧒 ZONA INFANTIL", open);
  await ensureText(guild, kids, "🧒-ninos-xochimilco", "Misiones familiares sobre chinampas y naturaleza.", open);
  await ensureText(guild, kids, "🎨-dibujos-de-los-peques", "Arte familiar sin datos personales.", open);

  const court = await ensureCategory(guild, "⚖️ JUSTICIA Y VETERANOS", justice);
  await ensureText(guild, court, "⚖️-judiciales", "Moderación y denuncias; evita publicar datos sensibles.", privatePermissions(guild, [roles.judge.id, ...staff]));
  await ensureText(guild, court, "🏛️-new-amsterdam", "Círculo para veteranos y La Chapiza.", privatePermissions(guild, [roles.veteran.id, roles.chapiza.id, ...staff]));

  const machines = await ensureCategory(guild, "🛠️ LA SALA DE MÁQUINAS", open);
  await ensureText(guild, machines, "🛠️-soporte-y-ayuda", "Soporte técnico y comunitario.", open);
  await ensureText(guild, machines, "💸-tienda-premium", "Planes oficiales de CHONGSEB.", open);

  await pinWelcome(welcome);
  await configureVisuals(guild);
  const otters = await assignDefaultOtter(guild, roles.otter);
  const veterans = await checkVeterans(guild, roles.veteran);
  return { roles, otters, veterans };
}

function staffAuthorized(message) {
  return Boolean(
    message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member?.roles.cache.some(role => STAFF_NAMES.has(role.name)),
  );
}

function controlAuthorized(message) {
  return Boolean(
    message.guild?.ownerId === message.author.id ||
    message.member?.roles.cache.some(role => STAFF_NAMES.has(role.name)),
  );
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function welcomeChannel(guild) {
  const preferred = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText &&
    normalized(channel.name) === normalized("👋-bienvenida-y-presentaciones"),
  );
  if (preferred) return preferred;

  const me = guild.members.me;
  return guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .filter(channel =>
      channel.permissionsFor(guild.roles.everyone)
        ?.has(PermissionFlagsBits.ViewChannel),
    )
    .filter(channel =>
      channel.permissionsFor(me)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ]),
    )
    .sort((left, right) => left.rawPosition - right.rawPosition)
    .first();
}

async function sendDynamicWelcome(member) {
  const channel = welcomeChannel(member.guild);
  if (!channel) {
    console.warn("No hay un canal público donde el bot pueda enviar embeds de bienvenida.");
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle("🦦 ¡Bienvenido al Cartel del Golfo!")
    .setDescription(
      "Has cruzado el umbral entre el Zócalo y los canales. Aquí, la nutria " +
      "cósmica te guiará por un multiverso de diseño, libertad y creatividad. " +
      "Explora, pregunta y conviértete en leyenda.",
    )
    .setColor("#FF00FF")
    .addFields(
      {
        name: "🌮 México",
        value: "Encuentra la magia del Zócalo y la tradición de Xochimilco.",
        inline: true,
      },
      {
        name: "🌷 Ámsterdam",
        value: "Pasea por los canales y descubre la libertad de los tulipanes.",
        inline: true,
      },
      {
        name: "🦦 La Nutria",
        value: "Sigue a nuestra mascota cósmica en sus aventuras.",
        inline: true,
      },
      {
        name: "🗓️ Llegada al multiverso",
        value: `<t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:F>`,
        inline: false,
      },
      {
        name: "✨ Dato de la cuenta",
        value: `Creada <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>.`,
        inline: false,
      },
    )
    .setFooter({
      text: "Cartel del Golfo — temática creativa ficticia; sin afiliación con organizaciones reales.",
    })
    .setTimestamp(member.joinedAt || new Date());

  const image = process.env.DISCORD_WELCOME_IMAGE_URL?.trim();
  if (image && validHttpsUrl(image)) embed.setThumbnail(image);

  await channel.send({
    content: `¡Bienvenido, <@${member.id}>!`,
    embeds: [embed],
    allowedMentions: { users: [member.id], roles: [], parse: [] },
  });
}

async function safeReply(message, content) {
  return message.reply({
    content,
    allowedMentions: { repliedUser: false, users: [] },
  });
}

client.on("guildMemberAdd", async member => {
  if (GUILD_ID && member.guild.id !== GUILD_ID) return;
  try {
    const roles = await member.guild.roles.fetch();
    const otter = roles.find(role => normalized(role.name) === normalized("🦦 La Nutria"));
    if (otter) await member.roles.add(otter, "Rol comunitario predeterminado");
    // La antigüedad se reevalúa diariamente; un miembro recién llegado aún no
    // cumple 30 días.
  } catch (error) {
    console.error("Alta de miembro:", error.message);
  }
  try {
    await sendDynamicWelcome(member);
  } catch (error) {
    console.error("Bienvenida dinámica:", error.message);
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return;
  if (GUILD_ID && message.guild.id !== GUILD_ID) return;
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  const supported = new Set([
    `${PREFIX}add-chapiza`,
    `${PREFIX}add-juez`,
    `${PREFIX}check-veteranos`,
    `${PREFIX}premium`,
    `${PREFIX}charly-control`,
    `${PREFIX}nutria-control`,
  ]);
  if (!supported.has(command)) return;

  if (command === `${PREFIX}nutria-control`) {
    try {
      await nutriaControl.show(message);
    } catch (error) {
      console.error("Panel Nutria:", error);
      await safeReply(message, "No se pudo abrir el panel de la Nutria.");
    }
    return;
  }

  if (command === `${PREFIX}charly-control`) {
    try {
      const state = await install(message.guild);
      await controlCommand.execute(message, { staffAuthorized: controlAuthorized, roles: state.roles });
    } catch (error) {
      console.error("Panel Charly:", error);
      await safeReply(message, "No se pudo abrir el panel seguro. Revisa permisos y jerarquía del bot.");
    }
    return;
  }

  if (command === `${PREFIX}premium`) {
    await safeReply(
      message,
      "Solicitud Premium registrada en el canal. Un Fundador o Moderador debe comprobar la suscripción antes de asignar roles.",
    );
    return;
  }

  if (!staffAuthorized(message)) {
    await safeReply(message, "Solo Fundador o Moderador puede ejecutar este comando.");
    return;
  }

  try {
    const state = await install(message.guild);
    if (command === `${PREFIX}check-veteranos`) {
      const result = await checkVeterans(message.guild, state.roles.veteran);
      await safeReply(message, `Revisión terminada: ${result.assigned} asignado(s), ${result.skipped} omitido(s).`);
      return;
    }

    const target = message.mentions.members.first();
    if (!target || target.user.bot) {
      await safeReply(message, `Uso: \`${command} @usuario\``);
      return;
    }
    const role = command === `${PREFIX}add-juez`
      ? state.roles.judge
      : state.roles.chapiza;
    if (!role.editable) {
      await safeReply(message, "Coloca el rol del bot por encima del rol que intentas asignar.");
      return;
    }
    await target.roles.add(role, `Asignado por ${message.author.tag}`);
    await safeReply(message, `${role.name} asignado correctamente a ${target}.`);
  } catch (error) {
    console.error("Comando CHONGSEB:", error);
    await safeReply(message, "No se pudo completar la operación. Revisa permisos y jerarquía.");
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.guild || (GUILD_ID && interaction.guild.id !== GUILD_ID)) return;
  try {
    await nutriaControl.handle(interaction);
  } catch (error) {
    console.error("Interacción Nutria:", error);
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "No se pudo completar la auditoría." }).catch(() => {});
      } else {
        await interaction.reply({ content: "No se pudo completar la auditoría.", ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.once("ready", async () => {
  try {
    const guild = await targetGuild();
    if (await confirmRebuild(guild)) await clearGuild(guild);
    else console.log("ℹ️ Modo sincronización: no se eliminarán canales ni roles.");
    const state = await install(guild);
    console.log(
      `✅ CHONGSEB instalado en ${guild.name}. ` +
      `Nutrias: ${state.otters}; veteranos nuevos: ${state.veterans.assigned}.`,
    );
    setInterval(async () => {
      try {
        const roles = await guild.roles.fetch();
        const veteran = roles.find(role => normalized(role.name) === normalized("🏛️ Veterano"));
        if (veteran) await checkVeterans(guild, veteran);
      } catch (error) {
        console.error("Revisión diaria:", error.message);
      }
    }, DAY_MS).unref();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
    client.destroy();
  }
});

client.login(TOKEN).catch(error => {
  console.error(`No se pudo autenticar el bot: ${error.message}`);
  process.exit(1);
});
