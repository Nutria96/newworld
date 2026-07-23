"use strict";

require("dotenv").config();
const { Readable } = require("node:stream");
const dns = require("node:dns").promises;
const net = require("node:net");
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
} = require("discord.js");
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource, entersState,
  AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior, StreamType,
} = require("@discordjs/voice");
const play = require("play-dl");
const config = require("./config");

if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN no está configurado");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
  ],
});
const queues = new Map();

if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  Promise.resolve(play.setToken({
    spotify: {
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      refresh_token: "",
      market: "MX",
    },
  })).catch(error => console.warn("Spotify metadata:", error.message));
}

function duration(seconds) {
  if (!Number.isFinite(seconds)) return "en vivo";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function trackFromVideo(video, requestedBy) {
  return {
    title: String(video.title || "Pista sin título").slice(0, 180),
    url: video.url,
    duration: Number(video.durationInSec) || 0,
    requestedBy,
    retries: 0,
  };
}

function privateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") ||
    value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb");
}

async function assertPublicAudioUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("La URL directa debe ser HTTPS y no incluir credenciales");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Dirección local bloqueada");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => privateAddress(item.address))) throw new Error("Dirección privada bloqueada");
  return url.href;
}

async function fetchPublicAudio(rawUrl) {
  let current = await assertPublicAudioUrl(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirección de audio inválida");
    current = await assertPublicAudioUrl(new URL(location, current).href);
  }
  throw new Error("Demasiadas redirecciones de audio");
}

async function youtubeSearch(query, requestedBy) {
  const [video] = await play.search(query, { limit: 1, source: { youtube: "video" } });
  if (!video) throw new Error("No encontré una pista reproducible");
  return trackFromVideo(video, requestedBy);
}

async function spotifyTracks(url, requestedBy) {
  const item = await play.spotify(url);
  const raw = item.type === "track" ? [item] : await item.all_tracks();
  const tracks = [];
  for (const song of raw.slice(0, config.maxPlaylistTracks)) {
    const artists = Array.isArray(song.artists) ? song.artists.map(artist => artist.name).join(" ") : "";
    tracks.push(await youtubeSearch(`${song.name} ${artists} audio`, requestedBy));
  }
  return tracks;
}

async function resolveInput(input, requestedBy) {
  const value = input.trim();
  if (!value) throw new Error("Escribe una URL o una búsqueda");
  const kind = await play.validate(value);
  if (kind === "yt_video") return [trackFromVideo((await play.video_basic_info(value)).video_details, requestedBy)];
  if (kind === "yt_playlist") {
    const playlist = await play.playlist_info(value, { incomplete: true });
    return (await playlist.all_videos()).slice(0, config.maxPlaylistTracks).map(video => trackFromVideo(video, requestedBy));
  }
  if (kind === "sp_track" || kind === "sp_album" || kind === "sp_playlist") return spotifyTracks(value, requestedBy);
  if (kind === "so_track") {
    const info = await play.soundcloud(value);
    return [{ title: info.name || "SoundCloud", url: value, duration: Number(info.durationInSec) || 0, requestedBy, retries: 0 }];
  }
  if (kind === "so_playlist") {
    const playlist = await play.soundcloud(value);
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    return tracks.slice(0, config.maxPlaylistTracks).map(item => ({
      title: item.name || "SoundCloud", url: item.url, duration: Number(item.durationInSec) || 0, requestedBy, retries: 0,
    }));
  }
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (/(?:twitch\.tv|bandcamp\.com)$/i.test(url.hostname) || /\.(?:bandcamp\.com)$/i.test(url.hostname)) {
      throw new Error("Esa fuente no ofrece un flujo compatible en esta instalación. Usa una URL directa de audio autorizada.");
    }
    return [{ title: url.pathname.split("/").pop() || url.hostname, url: url.href, duration: 0, requestedBy, direct: true, retries: 0 }];
  }
  return [await youtubeSearch(value, requestedBy)];
}

function guildQueue(message) {
  let queue = queues.get(message.guild.id);
  if (queue) return queue;
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  queue = {
    guildId: message.guild.id, tracks: [], current: null, connection: null, player,
    volume: config.defaultVolume, loop: false, textChannel: message.channel, idleTimer: null, playing: false,
  };
  player.on(AudioPlayerStatus.Idle, () => advance(queue));
  player.on("error", error => {
    console.error(`Audio ${queue.guildId}:`, error.message);
    queue.textChannel?.send("⚠️ La pista falló; intentaré continuar con la cola.").catch(() => {});
    if (queue.current && queue.current.retries < 1) {
      queue.current.retries += 1;
      queue.tracks.unshift(queue.current);
    }
    advance(queue);
  });
  queues.set(message.guild.id, queue);
  return queue;
}

async function connect(queue, voiceChannel) {
  if (queue.connection?.joinConfig.channelId === voiceChannel.id) return;
  queue.connection?.destroy();
  queue.connection = joinVoiceChannel({
    channelId: voiceChannel.id, guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator, selfDeaf: true,
  });
  await entersState(queue.connection, VoiceConnectionStatus.Ready, 20_000);
  queue.connection.subscribe(queue.player);
}

async function streamFor(track) {
  if (!track.direct) return play.stream(track.url, { discordPlayerCompatibility: true });
  const response = await fetchPublicAudio(track.url);
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !type.startsWith("audio/") || !response.body) throw new Error("La URL no es audio directo");
  return { stream: Readable.fromWeb(response.body), type: StreamType.Arbitrary };
}

async function playTrack(queue, track) {
  const source = await streamFor(track);
  const resource = createAudioResource(source.stream, { inputType: source.type, inlineVolume: true });
  resource.volume?.setVolume(queue.volume / 100);
  queue.current = track;
  queue.playing = true;
  queue.player.play(resource);
  await queue.textChannel?.send(`▶️ **${track.title}** · ${duration(track.duration)} · solicitada por ${track.requestedBy}`);
}

async function advance(queue) {
  if (queue.loop && queue.current) queue.tracks.unshift(queue.current);
  const next = queue.tracks.shift();
  queue.current = null;
  queue.playing = false;
  if (next) {
    try { await playTrack(queue, next); } catch (error) {
      queue.textChannel?.send(`⚠️ No pude reproducir **${next.title}**: ${error.message}`).catch(() => {});
      setTimeout(() => advance(queue), 500);
    }
    return;
  }
  clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(() => {
    queue.connection?.destroy();
    queues.delete(queue.guildId);
  }, config.idleDisconnectMs);
}

function requireVoice(message, queue) {
  const channel = message.member?.voice?.channel;
  if (!channel) throw new Error("Entra primero a un canal de voz");
  if (queue.connection && queue.connection.joinConfig.channelId !== channel.id) {
    throw new Error("Debes estar en el mismo canal de voz que el bot");
  }
  return channel;
}

function helpEmbed() {
  return new EmbedBuilder().setColor(0x00ffff).setTitle("🦦 DJ CHONGSEB")
    .setDescription([
      "`!play <URL o búsqueda>` agregar/reproducir", "`!search <texto>` buscar",
      "`!skip` saltar · `!stop` limpiar", "`!pause` / `!resume`",
      "`!queue` cola · `!nowplaying` actual", "`!volume <0-100>`",
      "`!remove <n>` eliminar · `!loop` repetir pista",
    ].join("\n"));
}

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot || !message.content.startsWith(config.prefix)) return;
  const [rawCommand, ...parts] = message.content.slice(config.prefix.length).trim().split(/\s+/);
  let command = rawCommand?.toLowerCase();
  if (command === "music") command = parts.shift()?.toLowerCase() || "help";
  const input = parts.join(" ");
  const queue = guildQueue(message);
  queue.textChannel = message.channel;
  try {
    if (["help", "commands"].includes(command)) return void message.reply({ embeds: [helpEmbed()] });
    if (command === "play" || command === "search") {
      const voice = requireVoice(message, queue);
      await connect(queue, voice);
      const tracks = await resolveInput(input, `<@${message.author.id}>`);
      const available = config.maxQueueTracks - queue.tracks.length;
      const accepted = tracks.slice(0, Math.max(0, available));
      if (!accepted.length) throw new Error("La cola está llena");
      queue.tracks.push(...accepted);
      await message.reply(`✅ Añadí ${accepted.length} pista(s) a la cola.`);
      if (!queue.playing && !queue.current) await advance(queue);
      return;
    }
    requireVoice(message, queue);
    if (command === "skip") queue.player.stop();
    else if (command === "stop") { queue.loop = false; queue.tracks.length = 0; queue.player.stop(); }
    else if (command === "pause") queue.player.pause();
    else if (command === "resume") queue.player.unpause();
    else if (command === "loop") { queue.loop = !queue.loop; await message.reply(`🔁 Bucle ${queue.loop ? "activado" : "desactivado"}.`); }
    else if (command === "volume") {
      const value = Number(parts[0]);
      if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error("Usa un volumen entre 0 y 100");
      queue.volume = value;
      queue.player.state.resource?.volume?.setVolume(value / 100);
      await message.reply(`🔊 Volumen: ${value}%`);
    } else if (command === "remove") {
      const index = Number(parts[0]) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= queue.tracks.length) throw new Error("Número de cola inválido");
      const [removed] = queue.tracks.splice(index, 1);
      await message.reply(`🗑️ Eliminé **${removed.title}**.`);
    } else if (command === "queue") {
      const lines = queue.tracks.slice(0, 10).map((track, index) => `${index + 1}. ${track.title.slice(0, 90)} · ${duration(track.duration)}`);
      await message.reply(`**Ahora:** ${queue.current?.title || "nada"}\n${lines.join("\n") || "Cola vacía"}`);
    } else if (command === "nowplaying") {
      await message.reply(queue.current ? `🎵 **${queue.current.title}** · ${duration(queue.current.duration)}` : "No hay ninguna pista sonando.");
    } else {
      await message.reply({ embeds: [helpEmbed()] });
    }
  } catch (error) {
    await message.reply(`⚠️ ${error.message}`).catch(() => {});
  }
});

client.once("ready", () => console.log(`DJ CHONGSEB conectado como ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
