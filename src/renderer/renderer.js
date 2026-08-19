const dropzone = document.getElementById('dropzone');
const fileListEl = document.getElementById('fileList');
const runBtn = document.getElementById('runBtn');
const dirLabel = document.getElementById('dirLabel');

let selectedFiles = []; // [{ path, name, kind, metadata, status, outPath, error }]
let outputDir = null;

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

async function addFiles(paths) {
  for (const p of paths) {
    if (selectedFiles.some((f) => f.path === p)) continue;
    const name = p.split(/[\\/]/).pop();
    const entry = {
      path: p,
      name,
      kind: null,
      metadata: null,
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
  runBtn.disabled = !(selectedFiles.length > 0 && outputDir);
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
  for (const entry of selectedFiles) {
    const row = document.createElement('div');
    row.className = 'file-row';
    const statusLine = entry.outPath
      ? `<div class="status ok">Saved → ${entry.outPath}</div>${entry.c2paNote ? `<div class="status ${entry.c2paNote.includes('still present') ? 'err' : 'ok'}">${entry.c2paNote}</div>` : ''}`
      : entry.status === 'error'
        ? `<div class="status err">${entry.error}</div>`
        : '';
    row.innerHTML = `
      <div class="name">${entry.name}</div>
      <div class="meta">${summarize(entry)}</div>
      ${statusLine}
    `;
    fileListEl.appendChild(row);
  }
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
  if (!outputDir) return;
  runBtn.disabled = true;
  runBtn.textContent = 'Processing…';
  const fields = collectFields();

  for (const entry of selectedFiles) {
    if (entry.status === 'error') continue;
    const processResponse = await window.compassclean.processFile({
      filePath: entry.path,
      outputDir,
      fields,
    });
    if (processResponse.ok) {
      entry.outPath = processResponse.outPath;
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
