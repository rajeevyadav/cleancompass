// Preload bridge: exposes a small, explicit `window.compassclean` API to the
// sandboxed renderer. contextIsolation is on and nodeIntegration is off, so the
// renderer can only reach the main process through these named IPC channels —
// it has no direct filesystem or Node access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('compassclean', {
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickSaveDir: () => ipcRenderer.invoke('pick-save-dir'),
  getProfile: () => ipcRenderer.invoke('get-profile'),
  setProfile: (profile) => ipcRenderer.invoke('set-profile', profile),
  inspectFile: (filePath) => ipcRenderer.invoke('inspect-file', filePath),
  processFile: (args) => ipcRenderer.invoke('process-file', args),
});
