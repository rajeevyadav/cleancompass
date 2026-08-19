// Image strip round-trip (node --test). Generates a PNG, embeds identifying
// tags via the same exiftool the app uses, then confirms scrubAndWrite removes
// them. Guards the exiftool-vendored upgrade path end-to-end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const { readMetadata, scrubAndWrite, closeExiftool } = require('../src/lib/imageMetadata');

test.after(async () => {
  await closeExiftool();
});

async function sha256(filePath) {
  return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

// A plain red PNG with identifying EXIF, written to `filePath`.
async function buildTaggedPng(filePath, size = 8) {
  await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .withMetadata({ exif: { IFD0: { Artist: 'Original Photographer', Software: 'SecretTool 1.0' } } })
    .png()
    .toFile(filePath);
}

test('scrubAndWrite strips embedded Artist/Software, keeps only supplied fields', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-img-'));
  const inPath = path.join(workDir, 'sample.png');
  const outPath = path.join(workDir, 'sample.cleaned.png');

  await buildTaggedPng(inPath);

  const before = await readMetadata(inPath);
  assert.ok(before.author || before.software, 'fixture should carry identifying metadata');

  const result = await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name' });

  const after = await readMetadata(outPath);
  // The security guarantee: the original identifying values are gone...
  const authorText = [].concat(after.author).join(',');
  assert.ok(!authorText.includes('Original Photographer'), 'original author must be stripped');
  assert.equal(after.software, '', 'original software must be stripped');
  // ...and only the supplied replacement remains.
  assert.ok(authorText.includes('Cleaned Name'), 'supplied author should be written back');

  // A plain PNG carries no C2PA manifest, so nothing was there to remove.
  assert.equal(result.c2pa.detectedBefore, false);
  assert.equal(result.c2pa.confirmedRemoved, null);

  await fs.rm(workDir, { recursive: true, force: true });
});

test('scrubAndWrite with no fields strips everything and writes nothing back', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-img-'));
  const inPath = path.join(workDir, 'sample.png');
  const outPath = path.join(workDir, 'sample.cleaned.png');
  await buildTaggedPng(inPath);

  await scrubAndWrite(inPath, outPath, {});

  const after = await readMetadata(outPath);
  assert.equal([].concat(after.author).join(','), '', 'no author should remain or be added');
  assert.equal(after.software, '');
  assert.equal(after.copyright, '');

  await fs.rm(workDir, { recursive: true, force: true });
});

test('resetFingerprint changes the output hash while preserving dimensions', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-img-'));
  const inPath = path.join(workDir, 'sample.png');
  const plainOut = path.join(workDir, 'plain.cleaned.png');
  const resetOut = path.join(workDir, 'reset.cleaned.png');
  await buildTaggedPng(inPath, 16);

  await scrubAndWrite(inPath, plainOut, { author: 'Cleaned Name' });
  await scrubAndWrite(inPath, resetOut, { author: 'Cleaned Name', resetFingerprint: true });

  const plainHash = await sha256(plainOut);
  const resetHash = await sha256(resetOut);
  assert.notEqual(resetHash, plainHash, 'fingerprint reset should change the file hash');

  const dims = await sharp(resetOut).metadata();
  assert.equal(dims.width, 16, 'reset image should keep its dimensions');
  assert.equal(dims.height, 16);

  await fs.rm(workDir, { recursive: true, force: true });
});

test('scrubAndWrite never modifies the source file', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-img-'));
  const inPath = path.join(workDir, 'sample.png');
  const outPath = path.join(workDir, 'sample.cleaned.png');
  await buildTaggedPng(inPath);

  const digestBefore = await sha256(inPath);
  await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name', resetFingerprint: true });
  const digestAfter = await sha256(inPath);

  assert.equal(digestAfter, digestBefore, 'source image must be byte-identical after scrubbing');

  await fs.rm(workDir, { recursive: true, force: true });
});
