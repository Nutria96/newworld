"use strict";

require("dotenv").config();

const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID?.trim();
const PREFIX = process.env.DISCORD_COMMAND_PREFIX || "!";
const VETERAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

if (!TOKEN) {
  console.error("Falta DISCORD_TOKEN en el archivo .env.");
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

const ROLE_SPECS = {
  judge: { name: "⚖️ Juez", color: "#8B0000" },
  veteran: { name: "🏛️ Veterano", color: "#123A73" },
  chapiza: { name: "✨ La Chapiza", color: "#FFD700" },
};

const STAFF_NAMES = new Set(["👑 Fundador", "🛡️ Moderador"]);

function normalize(name) {
  return String(name).toLocaleLowerCase("es-MX");
}

async function targetGuild() {
  if (GUILD_ID) return client.guilds.fetch(GUILD_ID);
  const guilds = await client.guilds.fetch();
  if (guilds.size !== 1) {
    throw new Error("Define GUILD_ID cuando el bot pertenezca a más de un servidor.");
  }
  return guilds.first().fetch();
}

async function ensureRole(guild, specification) {
  const roles = await guild.roles.fetch();
  const existing = roles.find(role => normalize(role.name) === normalize(specification.name));
  if (existing) {
    if (existing.editable) {
      await existing.edit({
        color: specification.color,
        reason: "Sincronización de acceso exclusivo CHONGSEB",
      });
    }
    return existing;
  }
  return guild.roles.create({
    name: specification.name,
    color: specification.color,
    permissions: [],
    reason: "Acceso exclusivo CHONGSEB",
  });
}

async function ensureCategory(guild, name) {
  const channels = await guild.channels.fetch();
  const existing = channels.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      normalize(channel.name) === normalize(name),
  );
  return existing || guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    reason: "Acceso exclusivo CHONGSEB",
  });
}

async function ensureTextChannel(guild, category, name, overwrites, topic) {
  const channels = await guild.channels.fetch();
  let channel = channels.find(
    item =>
      item.type === ChannelType.GuildText &&
      normalize(item.name) === normalize(name),
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic,
      permissionOverwrites: overwrites,
      reason: "Acceso exclusivo CHONGSEB",
    });
  } else {
    await channel.edit({
      parent: category.id,
      topic,
      permissionOverwrites: overwrites,
      reason: "Sincronización de acceso exclusivo CHONGSEB",
    });
  }
  return channel;
}

function staffRoleIds(guild) {
  return guild.roles.cache
    .filter(role => STAFF_NAMES.has(role.name))
    .map(role => role.id);
}

function privateOverwrites(guild, allowedRoleIds) {
  const view = PermissionFlagsBits.ViewChannel;
  const send = PermissionFlagsBits.SendMessages;
  return [
    { id: guild.roles.everyone.id, deny: [view] },
    ...allowedRoleIds.map(id => ({ id, allow: [view, send] })),
  ];
}

function canManage(message) {
  if (!message.member) return false;
  return (
    message.member.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member.roles.cache.some(role => STAFF_NAMES.has(role.name))
  );
}

function veteranEligible(member) {
  return (
    !member.user.bot &&
    member.joinedTimestamp &&
    Date.now() - member.joinedTimestamp >= VETERAN_DAYS * DAY_MS
  );
}

async function checkVeterans(guild, veteranRole) {
  const members = await guild.members.fetch();
  let assigned = 0;
  let skipped = 0;
  for (const member of members.values()) {
    if (!veteranEligible(member) || member.roles.cache.has(veteranRole.id)) continue;
    if (!veteranRole.editable) {
      skipped += 1;
      continue;
    }
    try {
      await member.roles.add(veteranRole, "30 días de antigüedad en CHONGSEB");
      assigned += 1;
    } catch {
      skipped += 1;
    }
  }
  return { assigned, skipped };
}

async function install(guild) {
  const me = await guild.members.fetchMe();
  if (
    !me.permissions.has(PermissionFlagsBits.ManageRoles) ||
    !me.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    throw new Error("El bot necesita Manage Roles y Manage Channels.");
  }

  const judge = await ensureRole(guild, ROLE_SPECS.judge);
  const veteran = await ensureRole(guild, ROLE_SPECS.veteran);
  const chapiza = await ensureRole(guild, ROLE_SPECS.chapiza);
  const category = await ensureCategory(guild, "🔐 CÍRCULOS EXCLUSIVOS");
  const staff = staffRoleIds(guild);

  const judicial = await ensureTextChannel(
    guild,
    category,
    "⚖️-judiciales",
    privateOverwrites(guild, [judge.id, ...staff]),
    "Moderación y denuncias. No publiques información personal ni documentos legales sensibles.",
  );
  const newAmsterdam = await ensureTextChannel(
    guild,
    category,
    "🏛️-new-amsterdam",
    privateOverwrites(guild, [veteran.id, chapiza.id, ...staff]),
    "Círculo privado para veteranos y miembros de confianza.",
  );

  return { judge, veteran, chapiza, judicial, newAmsterdam };
}

async function reply(message, text) {
  await message.reply({
    content: text,
    allowedMentions: { repliedUser: false, users: [] },
  });
}

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return;
  if (GUILD_ID && message.guild.id !== GUILD_ID) return;

  const [rawCommand] = message.content.trim().split(/\s+/);
  const command = rawCommand.toLowerCase();
  if (![`${PREFIX}add-chapiza`, `${PREFIX}check-veteranos`].includes(command)) return;

  if (!canManage(message)) {
    await reply(message, "No tienes permisos para ejecutar este comando.");
    return;
  }

  try {
    const state = await install(message.guild);
    if (command === `${PREFIX}add-chapiza`) {
      const target = message.mentions.members.first();
      if (!target || target.user.bot) {
        await reply(message, `Uso correcto: \`${PREFIX}add-chapiza @usuario\``);
        return;
      }
      if (!state.chapiza.editable) {
        await reply(message, "El rol del bot debe estar por encima de “La Chapiza”.");
        return;
      }
      await target.roles.add(
        state.chapiza,
        `Asignado manualmente por ${message.author.tag}`,
      );
      await reply(message, `Rol La Chapiza asignado correctamente a ${target}.`);
      return;
    }

    const result = await checkVeterans(message.guild, state.veteran);
    await reply(
      message,
      `Revisión terminada: ${result.assigned} veterano(s) asignado(s)` +
        (result.skipped ? `; ${result.skipped} omitido(s) por permisos o jerarquía.` : "."),
    );
  } catch (error) {
    console.error("Comando exclusivo:", error);
    await reply(message, "No se pudo completar la operación. Revisa permisos y jerarquía del bot.");
  }
});

client.once("ready", async () => {
  try {
    const guild = await targetGuild();
    const state = await install(guild);
    const result = await checkVeterans(guild, state.veteran);
    console.log(
      `✅ Canales exclusivos activos en ${guild.name}. ` +
      `${result.assigned} veterano(s) asignado(s).`,
    );

    setInterval(async () => {
      try {
        const refreshed = await guild.fetch();
        const roles = await refreshed.roles.fetch();
        const veteran = roles.find(
          role => normalize(role.name) === normalize(ROLE_SPECS.veteran.name),
        );
        if (veteran) await checkVeterans(refreshed, veteran);
      } catch (error) {
        console.error("Revisión diaria de veteranos:", error.message);
      }
    }, DAY_MS).unref();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    client.destroy();
    process.exitCode = 1;
  }
});

client.login(TOKEN).catch(error => {
  console.error(`No se pudo autenticar el bot: ${error.message}`);
  process.exit(1);
});
