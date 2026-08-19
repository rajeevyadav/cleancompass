// Renderer UI logic: manages the selected-file list, drives inspect/scrub via
// the window.compassclean IPC bridge, and renders per-file status (including the
// C2PA removal note). Holds no metadata logic of its own — it only presents what
// the main process returns and collects the fields the user fills in.
const dropzone = document.getElementById('dropzone');
const fileListEl = document.getElementById('fileList');
const runBtn = document.getElementById('runBtn');
const dirLabel = document.getElementById('dirLabel');

let selectedFiles = []; // [{ path, name, kind, metadata, status, outPath, error }]
let outputDir = null;

// Light/dark theme toggle. The initial theme is set before paint by the inline
// script in index.html; here we sync the button icon and persist changes.
const themeToggle = document.getElementById('themeToggle');
function activeTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
}
applyTheme(activeTheme());
themeToggle.addEventListener('click', () => {
  applyTheme(activeTheme() === 'dark' ? 'light' : 'dark');
});

async function loadProfile() {
  const profile = await window.compassclean.getProfile();
  document.getElementById('p-author').value = profile.author || '';
  document.getElementById('p-company').value = profile.company || '';
}
loadProfile();

document.getElementById('saveProfile').addEventListener('click', async () => {
  const profile = {
    author: document.getElementById('p-author').value.trim(),
    company: document.getElementById('p-company').value.trim(),
    title: '',
    comments: '',
  };
  await window.compassclean.setProfile(profile);
});

document.getElementById('f-setdates').addEventListener('change', (e) => {
  document.getElementById('f-cleardates').checked = !e.target.checked;
});
document.getElementById('f-cleardates').addEventListener('change', (e) => {
  document.getElementById('f-setdates').checked = !e.target.checked;
});

dropzone.addEventListener('click', async () => {
  const paths = await window.compassclean.pickFiles();
  if (paths && paths.length) await addFiles(paths);
});

dropzone.addEventListener('dragover', (e) => e.preventDefault());
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const paths = Array.from(e.dataTransfer.files)
    .map((f) => (window.electronPathFor ? window.electronPathFor(f) : f.path))
    .filter(Boolean);
  if (paths.length) {
    await addFiles(paths);
  } else {
    // Newer Electron sandboxes may not expose file.path; fall back to the picker.
    const picked = await window.compassclean.pickFiles();
    if (picked && picked.length) await addFiles(picked);
  }
});

document.getElementById('pickDir').addEventListener('click', async () => {
  const dir = await window.compassclean.pickSaveDir();
  if (dir) {
    outputDir = dir;
    dirLabel.textContent = dir;
    updateRunButton();
  }
});

document.getElementById('clearDir').addEventListener('click', () => {
  outputDir = null;
  dirLabel.textContent = 'Next to each original';
  updateRunButton();
});

async function addFiles(paths) {
  for (const p of paths) {
    if (selectedFiles.some((f) => f.path === p)) continue;
    const name = p.split(/[\\/]/).pop();
    const entry = {
      path: p,
      name,
      kind: null,
      metadata: null,
      afterMetadata: null,
      expanded: false,
      status: 'inspecting',
      outPath: null,
      error: null,
    };
    selectedFiles.push(entry);
    render();
    const inspectResponse = await window.compassclean.inspectFile(p);
    if (inspectResponse.ok) {
      entry.kind = inspectResponse.kind;
      entry.metadata = inspectResponse.metadata;
      entry.status = 'ready';
    } else {
      entry.status = 'error';
      entry.error = inspectResponse.error;
    }
    render();
  }
  updateRunButton();
}

function updateRunButton() {
  // Output folder is optional now (defaults to next-to-source), so the Run
  // button only depends on having files selected (D-002 #3).
  runBtn.disabled = selectedFiles.length === 0;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Flatten a per-format metadata object into ordered [label, value] pairs so the
// Before/After tables share one field layout (D-002 #2).
function metadataFields(kind, m) {
  if (!m) return [];
  if (kind === 'ooxml') {
    const c = m.core || {};
    const a = m.app || {};
    return [
      ['Author', c.creator],
      ['Last modified by', c.lastModifiedBy],
      ['Title', c.title],
      ['Subject', c.subject],
      ['Description', c.description],
      ['Keywords', c.keywords],
      ['Category', c.category],
      ['Created', c.created],
      ['Modified', c.modified],
      ['Application', a.application],
      ['App version', a.appVersion],
      ['Company', a.company],
      ['Manager', a.manager],
      ['Custom properties', m.hasCustomProperties ? 'present' : ''],
    ];
  }
  if (kind === 'pdf') {
    return [
      ['Title', m.title],
      ['Author', m.author],
      ['Subject', m.subject],
      ['Keywords', m.keywords],
      ['Creator', m.creator],
      ['Producer', m.producer],
      ['Created', m.creationDate],
      ['Modified', m.modificationDate],
    ];
  }
  if (kind === 'image') {
    return [
      ['Author', m.author],
      ['Copyright', m.copyright],
      ['Description', m.description],
      ['Software', m.software],
      ['Generation parameters', m.parameters],
      ['Comment', m.comment],
      ['GPS', m.gps],
      ['C2PA manifest', m.hasC2PA ? 'present' : ''],
    ];
  }
  return [];
}

// Blank/absent fields read as "— none —" so a cleared field is visibly
// confirmed rather than silently omitted (D-002 #2).
function cellValue(value) {
  const text = (
    Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)
  ).trim();
  return text ? escapeHtml(text) : '<span class="none">— none —</span>';
}

function detailTable(entry) {
  const before = metadataFields(entry.kind, entry.metadata);
  const afterMap = new Map(metadataFields(entry.kind, entry.afterMetadata));
  const hasAfter = !!entry.afterMetadata;
  const rows = before
    .map(
      ([label, beforeValue]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${cellValue(beforeValue)}</td>
          <td>${hasAfter ? cellValue(afterMap.get(label)) : '<span class="none">—</span>'}</td>
        </tr>`
    )
    .join('');
  return `
    <table class="meta-table">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function summarize(entry) {
  if (entry.status === 'inspecting') return 'Reading metadata…';
  if (entry.status === 'error') return `Error: ${entry.error}`;
  const d = entry.metadata || {};
  if (entry.kind === 'ooxml') {
    const bits = [];
    if (d.core?.creator) bits.push(`Author: ${d.core.creator}`);
    if (d.app?.company) bits.push(`Company: ${d.app.company}`);
    if (d.app?.application) bits.push(`App: ${d.app.application}`);
    if (d.hasCustomProperties) bits.push('Has custom properties');
    return bits.length ? bits.join(' · ') : 'No notable metadata found';
  }
  if (entry.kind === 'pdf') {
    const bits = [];
    if (d.author) bits.push(`Author: ${d.author}`);
    if (d.producer) bits.push(`Producer: ${d.producer}`);
    if (d.creator) bits.push(`Creator: ${d.creator}`);
    return bits.length ? bits.join(' · ') : 'No notable metadata found';
  }
  if (entry.kind === 'image') {
    const bits = [];
    if (d.software) bits.push(`Software: ${d.software}`);
    if (d.parameters) bits.push('Has embedded generation parameters');
    if (d.hasC2PA) bits.push('Has C2PA content credentials');
    if (d.author) bits.push(`Author: ${d.author}`);
    return bits.length ? bits.join(' · ') : 'No notable metadata found';
  }
  return '';
}

function render() {
  fileListEl.innerHTML = '';
  selectedFiles.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    const statusLine = entry.outPath
      ? `<div class="status ok">Saved → ${escapeHtml(entry.outPath)}</div>${entry.c2paNote ? `<div class="status ${entry.c2paNote.includes('still present') ? 'err' : 'ok'}">${escapeHtml(entry.c2paNote)}</div>` : ''}`
      : entry.status === 'error'
        ? `<div class="status err">${escapeHtml(entry.error)}</div>`
        : '';
    const canExpand = entry.status === 'ready' || entry.outPath;
    const caret = canExpand ? (entry.expanded ? '▾ ' : '▸ ') : '';
    const detail =
      canExpand && entry.expanded ? `<div class="detail">${detailTable(entry)}</div>` : '';
    row.innerHTML = `
      <div class="name${canExpand ? ' clickable' : ''}" data-index="${index}">${caret}${escapeHtml(entry.name)}</div>
      <div class="meta">${escapeHtml(summarize(entry))}</div>
      ${statusLine}
      ${detail}
    `;
    if (canExpand) {
      const nameEl = row.querySelector('.name.clickable');
      nameEl.addEventListener('click', () => {
        entry.expanded = !entry.expanded;
        render();
      });
    }
    fileListEl.appendChild(row);
  });
}

function collectFields() {
  return {
    author: document.getElementById('p-author').value.trim(),
    company: document.getElementById('p-company').value.trim(),
    title: document.getElementById('f-title').value.trim(),
    keywords: document.getElementById('f-keywords').value.trim(),
    comments: document.getElementById('f-comments').value.trim(),
    lastModifiedBy: document.getElementById('f-lastmod').value.trim(),
    setDatesNow: document.getElementById('f-setdates').checked,
    clearDates: document.getElementById('f-cleardates').checked,
    resetFingerprint: document.getElementById('f-resetfp').checked,
  };
}

runBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;
  runBtn.disabled = true;
  runBtn.textContent = 'Processing…';
  const fields = collectFields();

  for (const entry of selectedFiles) {
    if (entry.status === 'error') continue;
    // outputDir is null when the user hasn't chosen a folder; the main process
    // then saves next to each source file (D-002 #3).
    const processResponse = await window.compassclean.processFile({
      filePath: entry.path,
      outputDir,
      fields,
    });
    if (processResponse.ok) {
      entry.outPath = processResponse.outPath;
      entry.afterMetadata = processResponse.afterMetadata || null;
      entry.expanded = true; // reveal the Before/After comparison automatically
      const c2paInfo = processResponse.extra?.c2pa;
      if (c2paInfo && c2paInfo.detectedBefore) {
        entry.c2paNote = c2paInfo.confirmedRemoved
          ? 'C2PA manifest detected and removed (verified).'
          : 'C2PA manifest detected but still present after strip — flag this file.';
      }
    } else {
      entry.status = 'error';
      entry.error = processResponse.error;
    }
    render();
  }

  runBtn.textContent = 'Scrub & Save';
  runBtn.disabled = false;
});
