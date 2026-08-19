// PDF Info-dictionary strip round-trip (node --test). Builds a PDF carrying
// identifying metadata via pdf-lib, then confirms scrubAndWrite clears it and
// writes back only supplied fields.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { PDFDocument } = require('pdf-lib');

const { readMetadata, scrubAndWrite } = require('../src/lib/pdfMetadata');

async function buildSamplePdf(filePath) {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setTitle('Confidential Draft');
  doc.setAuthor('Original Author');
  doc.setSubject('Internal Only');
  doc.setCreator('SecretTool');
  doc.setProducer('SecretTool Engine');
  await fs.writeFile(filePath, await doc.save());
}

async function sha256(filePath) {
  return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

test('scrubAndWrite clears the PDF Info dict and writes back only supplied fields', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-pdf-'));
  const inPath = path.join(workDir, 'sample.pdf');
  const outPath = path.join(workDir, 'sample.cleaned.pdf');
  await buildSamplePdf(inPath);

  const before = await readMetadata(inPath);
  assert.equal(before.author, 'Original Author');
  assert.equal(before.producer, 'SecretTool Engine');

  await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name' });

  const after = await readMetadata(outPath);
  assert.equal(after.author, 'Cleaned Name');
  assert.equal(after.title, '');
  assert.equal(after.subject, '');
  assert.equal(after.creator, '');
  assert.equal(after.producer, '');

  await fs.rm(workDir, { recursive: true, force: true });
});

test('scrubAndWrite with no fields produces an empty Info dict', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-pdf-'));
  const inPath = path.join(workDir, 'sample.pdf');
  const outPath = path.join(workDir, 'sample.cleaned.pdf');
  await buildSamplePdf(inPath);

  await scrubAndWrite(inPath, outPath, {});

  const after = await readMetadata(outPath);
  assert.equal(after.author, '');
  assert.equal(after.title, '');
  assert.equal(after.producer, '');

  await fs.rm(workDir, { recursive: true, force: true });
});

test('scrubAndWrite never modifies the source file', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-pdf-'));
  const inPath = path.join(workDir, 'sample.pdf');
  const outPath = path.join(workDir, 'sample.cleaned.pdf');
  await buildSamplePdf(inPath);

  const digestBefore = await sha256(inPath);
  await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name' });
  const digestAfter = await sha256(inPath);

  assert.equal(digestAfter, digestBefore, 'source PDF must be byte-identical after scrubbing');

  await fs.rm(workDir, { recursive: true, force: true });
});
