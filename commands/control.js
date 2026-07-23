"use strict";

const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const ALLOWED_CHANNELS = new Set([
  "🏛️-new-amsterdam",
  "🛠️-soporte-y-ayuda",
  "💸-tienda-premium",
]);

function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("es-MX");
}

function allowedChannel(message) {
  const name = normalized(message.channel?.name);
  const parent = normalized(message.channel?.parent?.name);
  return [...ALLOWED_CHANNELS].some(item => normalized(item) === name) ||
    parent === normalized("🛠️ LA SALA DE MÁQUINAS");
}

async function execute(message, { staffAuthorized, roles }) {
  if (!staffAuthorized(message)) {
    await message.reply({
      content: "Solo el Fundador o un Moderador de CHONGSEB puede abrir el panel de control.",
      allowedMentions: { repliedUser: false },
    });
    return;
  }
  if (!allowedChannel(message)) {
    await message.reply({
      content: "Usa este comando en #🏛️-new-amsterdam o en la Sala de Máquinas.",
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  const me = await message.guild.members.fetchMe();
  const visualRole = roles.master;
  let visualStatus = "No disponible";
  if (visualRole?.editable) {
    if (!me.roles.cache.has(visualRole.id)) {
      await me.roles.add(visualRole, `Panel seguro solicitado por ${message.author.tag}`);
    }
    if (!visualRole.hoist) {
      await visualRole.setHoist(true, "Identidad visual del Maestro de Ámsterdam");
    }
    visualStatus = "Rol visual aplicado (sin privilegios administrativos)";
  } else if (visualRole) {
    visualStatus = "El rol está por encima del bot; no fue modificado";
  }

  const permissions = [
    ["Gestionar canales", PermissionFlagsBits.ManageChannels],
    ["Gestionar roles inferiores", PermissionFlagsBits.ManageRoles],
    ["Gestionar mensajes", PermissionFlagsBits.ManageMessages],
  ].map(([label, permission]) => `${me.permissions.has(permission) ? "✅" : "❌"} ${label}`);

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🦦✨ Maestro de Ámsterdam · Panel seguro")
    .setDescription(
      "La Nutria Cósmica revisó la infraestructura. Este comando no eleva privilegios, " +
      "no elimina la jerarquía de Discord y no desactiva la verificación de edad.",
    )
    .addFields(
      { name: "Identidad", value: visualStatus },
      { name: "Permisos operativos", value: permissions.join("\n") },
      { name: "Protección adulta", value: "✅ Activa y sin cambios" },
      { name: "Control", value: "¡El Maestro de Ámsterdam ha abierto el panel seguro! El multiverso está bajo supervisión." },
    )
    .setFooter({ text: `Solicitado por ${message.author.tag}` })
    .setTimestamp();

  await message.reply({
    embeds: [embed],
    allowedMentions: { repliedUser: false, users: [], roles: [] },
  });
}

module.exports = { execute };
