// Electron main process: owns the application window, the persisted user
// profile (remembered author/company defaults), and the IPC handlers the
// renderer calls to inspect and scrub files. Each handler delegates the actual
// metadata work to the format-specific library and returns a plain
// { ok, ... } result the renderer can render directly.
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

const office = require('../lib/officeMetadata');
const pdf = require('../lib/pdfMetadata');
const image = require('../lib/imageMetadata');

const README_URL = 'https://github.com/rajeevyadav/cleancompass#readme';

// Turn an otherwise-fatal main-process error into a visible message rather than
// a silent crash or the OS Just-In-Time debugger dialog. Without this, a native
// dependency failing to load takes the whole app down before any window shows.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err);
  try {
    dialog.showErrorBox(
      'Compass Clean — unexpected error',
      String(err && err.stack ? err.stack : err)
    );
  } catch {
    // dialog is unavailable before the app is ready; the console log stands in.
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in main process:', reason);
});

// Disable GPU hardware acceleration. This is a metadata utility with no need
// for it, and GPU-process crashes on machines with problematic graphics drivers
// are a common cause of Electron apps crashing on launch (surfacing as the
// Windows Just-In-Time debugger). Software rendering is more than fast enough
// here and far more portable. Must be called before the app is ready.
app.disableHardwareAcceleration();

// If a renderer or child process still dies, log it and surface a readable
// message instead of a silent crash.
app.on('child-process-gone', (_event, details) => {
  console.error('Child process gone:', details.type, details.reason);
});

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
    title: `Compass Clean v${app.getVersion()}`,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Keep the version shown in the window title; otherwise the page's <title>
  // would overwrite it (D-002 #6 — make the running version visible).
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(`Compass Clean v${app.getVersion()}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
    dialog.showErrorBox(
      'Compass Clean — display error',
      `The window failed to render (${details.reason}). If this persists, updating your graphics drivers usually resolves it.`
    );
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Application menu with a populated Help submenu (D-002 #6): About with the
// version and description, a usage note, and a link to the README.
function buildAppMenu() {
  const helpSubmenu = [
    {
      label: 'About Compass Clean',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About Compass Clean',
          message: `Compass Clean v${app.getVersion()}`,
          detail:
            'Strip embedded metadata from documents and images (DOCX/PPTX/XLSX, ' +
            'PDF, PNG/JPG/WebP/TIFF), then write back only the fields you specify. ' +
            'Originals are never modified.',
          buttons: ['OK'],
        });
      },
    },
    {
      label: 'How to use',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'How to use Compass Clean',
          message: 'Three steps',
          detail:
            '1. Drag files onto the drop zone (or click it to browse).\n' +
            '2. Optionally fill in Author/Company and per-batch fields — blank ' +
            'fields are cleared, not kept.\n' +
            '3. Click "Scrub & Save". Cleaned copies are written next to each ' +
            'original as <name>.cleaned.<ext> unless you choose an output folder.',
          buttons: ['OK'],
        });
      },
    },
    { type: 'separator' },
    {
      label: 'View README (online)',
      click: () => shell.openExternal(README_URL),
    },
  ];

  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: helpSubmenu },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildAppMenu();
  createWindow();
});

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
  // Default to saving the cleaned copy next to its source when the user has not
  // chosen an output folder — zero-click usable (D-002 #3).
  const targetDir = outputDir || path.dirname(filePath);
  const outPath = path.join(targetDir, `${base}.cleaned${ext}`);

  try {
    let extra = null;
    let afterMetadata = null;
    if (['.docx', '.pptx', '.xlsx'].includes(ext)) {
      await office.scrubAndWrite(filePath, outPath, fields);
      afterMetadata = await office.readMetadata(outPath);
    } else if (ext === '.pdf') {
      await pdf.scrubAndWrite(filePath, outPath, fields);
      afterMetadata = await pdf.readMetadata(outPath);
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(ext)) {
      extra = await image.scrubAndWrite(filePath, outPath, fields);
      afterMetadata = await image.readMetadata(outPath);
    } else {
      return { ok: false, error: `Unsupported file type: ${ext}` };
    }
    // afterMetadata is the re-read metadata of the cleaned file, so the renderer
    // can show a Before/After comparison (D-002 #2).
    return { ok: true, outPath, extra, afterMetadata };
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
