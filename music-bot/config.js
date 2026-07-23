"use strict";

module.exports = Object.freeze({
  prefix: process.env.MUSIC_PREFIX || "!",
  maxPlaylistTracks: Math.max(1, Math.min(Number(process.env.MAX_PLAYLIST_TRACKS) || 50, 50)),
  maxQueueTracks: 200,
  defaultVolume: 70,
  idleDisconnectMs: 5 * 60 * 1000,
});
