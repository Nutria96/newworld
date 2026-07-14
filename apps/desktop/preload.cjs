const { contextBridge, shell } = require("electron");
contextBridge.exposeInMainWorld("nativeBridge", {
  platform: process.platform,
  openExternal: (url) => /^https:\/\//.test(url) && shell.openExternal(url)
});
