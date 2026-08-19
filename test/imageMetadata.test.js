// Image strip round-trip (node --test). Generates a PNG, embeds identifying
// tags via the same exiftool the app uses, then confirms scrubAndWrite removes
// them. Guards the exiftool-vendored upgrade path end-to-end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const { readMetadata, scrubAndWrite, closeExiftool } = require('../src/lib/imageMetadata');

test.after(async () => {
  await closeExiftool();
});

test('scrubAndWrite strips embedded Artist/Software, keeps only supplied fields', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-img-'));
  const inPath = path.join(workDir, 'sample.png');
  const outPath = path.join(workDir, 'sample.cleaned.png');

  // A plain 8x8 red PNG, then stamp identifying metadata onto it.
  await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .withMetadata({ exif: { IFD0: { Artist: 'Original Photographer', Software: 'SecretTool 1.0' } } })
    .png()
    .toFile(inPath);

  const before = await readMetadata(inPath);
  assert.ok(before.author || before.software, 'fixture should carry identifying metadata');

  await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name' });

  const after = await readMetadata(outPath);
  // The security guarantee: the original identifying values are gone...
  const authorText = [].concat(after.author).join(',');
  assert.ok(!authorText.includes('Original Photographer'), 'original author must be stripped');
  assert.equal(after.software, '', 'original software must be stripped');
  // ...and only the supplied replacement remains.
  assert.ok(authorText.includes('Cleaned Name'), 'supplied author should be written back');

  await fs.rm(workDir, { recursive: true, force: true });
});
