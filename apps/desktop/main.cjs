const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1180, height: 800, minWidth: 360, minHeight: 640,
    backgroundColor: "#070b18", title: "NASA de Chong",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("file:")) { event.preventDefault(); shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, "../web/index.html"));
}
app.whenReady().then(() => { createWindow(); app.on("activate", () => BrowserWindow.getAllWindows().length || createWindow()); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
