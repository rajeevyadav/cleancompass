const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('compassclean', {
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickSaveDir: () => ipcRenderer.invoke('pick-save-dir'),
  getProfile: () => ipcRenderer.invoke('get-profile'),
  setProfile: (profile) => ipcRenderer.invoke('set-profile', profile),
  inspectFile: (filePath) => ipcRenderer.invoke('inspect-file', filePath),
  processFile: (args) => ipcRenderer.invoke('process-file', args),
});
