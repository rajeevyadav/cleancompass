const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

const office = require('../lib/officeMetadata');
const pdf = require('../lib/pdfMetadata');
const image = require('../lib/imageMetadata');

const store = new Store({
  name: 'compassclean-profile',
  defaults: {
    profile: {
      author: '',
      company: '',
      title: '',
      comments: '',
    },
  },
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- File picking ----
ipcMain.handle('pick-files', async () => {
  const fileSelection = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Supported documents',
        extensions: ['docx', 'pptx', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'],
      },
    ],
  });
  if (fileSelection.canceled) return [];
  return fileSelection.filePaths;
});

ipcMain.handle('pick-save-dir', async () => {
  const dirSelection = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (dirSelection.canceled) return null;
  return dirSelection.filePaths[0];
});

// ---- Profile (remembered author/company defaults) ----
ipcMain.handle('get-profile', () => store.get('profile'));
ipcMain.handle('set-profile', (_evt, profile) => {
  store.set('profile', profile);
  return store.get('profile');
});

// ---- Inspect: read current metadata for a file, format-detected ----
ipcMain.handle('inspect-file', async (_evt, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (['.docx', '.pptx', '.xlsx'].includes(ext)) {
      return { ok: true, kind: 'ooxml', ext, metadata: await office.readMetadata(filePath) };
    }
    if (ext === '.pdf') {
      return { ok: true, kind: 'pdf', ext, metadata: await pdf.readMetadata(filePath) };
    }
    if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(ext)) {
      return { ok: true, kind: 'image', ext, metadata: await image.readMetadata(filePath) };
    }
    return { ok: false, error: `Unsupported file type: ${ext}` };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// ---- Process: strip, then write back only the fields the user supplied ----
// fields = { author, company, title, comments, lastModifiedBy, keywords, subject, category, manager, setDatesNow, clearDates }
ipcMain.handle('process-file', async (_evt, { filePath, outputDir, fields }) => {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, ext);
  const outPath = path.join(outputDir, `${base}.cleaned${ext}`);

  try {
    let extra = null;
    if (['.docx', '.pptx', '.xlsx'].includes(ext)) {
      await office.scrubAndWrite(filePath, outPath, fields);
    } else if (ext === '.pdf') {
      await pdf.scrubAndWrite(filePath, outPath, fields);
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(ext)) {
      extra = await image.scrubAndWrite(filePath, outPath, fields);
    } else {
      return { ok: false, error: `Unsupported file type: ${ext}` };
    }
    return { ok: true, outPath, extra };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

app.on('will-quit', async () => {
  try {
    await image.closeExiftool();
  } catch (_) {
    /* noop */
  }
});
