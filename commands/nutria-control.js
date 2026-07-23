"use strict";

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, PermissionFlagsBits,
} = require("discord.js");

const PREFIX = "nutria-control:";

function founderAuthorized(subject) {
  const member = subject.member;
  return Boolean(member?.roles?.cache?.some(role => role.name === "👑 Fundador"));
}

function panelEmbed(guild) {
  return new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🦦✨ Nutria Maestra de Ámsterdam")
    .setDescription(
      "Panel de auditoría del servidor. No eleva privilegios, no concede Administrator " +
      "y no modifica controles de edad. Las acciones sensibles se realizan manualmente " +
      "desde Discord con confirmación del propietario.",
    )
    .addFields(
      { name: "Servidor", value: guild.name, inline: true },
      { name: "Modo", value: "Supervisión segura", inline: true },
    )
    .setTimestamp();
}

function controls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}roles`).setLabel("Gestionar roles").setEmoji("🔧").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PREFIX}channels`).setLabel("Gestionar canales").setEmoji("📂").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PREFIX}privileges`).setLabel("Dar permisos de admin").setEmoji("👑").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${PREFIX}stats`).setLabel("Estadísticas").setEmoji("📊").setStyle(ButtonStyle.Success),
  );
}

async function show(message) {
  if (!founderAuthorized(message)) {
    await message.reply({ content: "❌ Solo el fundador puede invocar el control de la nutria.", allowedMentions: { repliedUser: false } });
    return;
  }
  await message.reply({ embeds: [panelEmbed(message.guild)], components: [controls()], allowedMentions: { repliedUser: false } });
}

async function handle(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith(PREFIX)) return false;
  if (!founderAuthorized(interaction)) {
    await interaction.reply({ content: "❌ Solo el fundador puede invocar el control de la nutria.", ephemeral: true });
    return true;
  }
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const me = await guild.members.fetchMe();
  const action = interaction.customId.slice(PREFIX.length);

  if (action === "roles") {
    await interaction.editReply(
      "🔧 Gestión de roles: función en desarrollo. Usa la configuración de Discord para conservar confirmación y registro de auditoría.",
    );
  } else if (action === "channels") {
    await interaction.editReply(
      "📂 Gestión de canales: función en desarrollo. Crear o eliminar canales requiere una confirmación explícita fuera de este panel.",
    );
  } else if (action === "privileges") {
    const checks = [
      ["Manage Channels", PermissionFlagsBits.ManageChannels],
      ["Manage Roles", PermissionFlagsBits.ManageRoles],
      ["Manage Messages", PermissionFlagsBits.ManageMessages],
      ["Administrator", PermissionFlagsBits.Administrator],
    ].map(([name, bit]) => `${me.permissions.has(bit) ? "✅" : "❌"} ${name}`);
    await interaction.editReply(
      `👑 Permisos actuales del bot:\n${checks.join("\n")}\n\n` +
      "**Por seguridad, este botón no concede Administrator.** El propietario debe administrar privilegios manualmente desde Discord.",
    );
  } else if (action === "stats") {
    const members = await guild.members.fetch();
    const bots = members.filter(member => member.user.bot).size;
    await interaction.editReply(
      `📊 Miembros: **${members.size}** · personas: **${members.size - bots}** · bots: **${bots}** · ` +
      `roles: **${guild.roles.cache.size - 1}** · canales: **${guild.channels.cache.size}**.`,
    );
  } else {
    await interaction.editReply("Acción desconocida.");
  }
  return true;
}

module.exports = { show, handle };
