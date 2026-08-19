const { ExifTool } = require('exiftool-vendored');
const { createC2pa } = require('c2pa-node');
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

let exiftool = null;
function getExiftool() {
  if (!exiftool) exiftool = new ExifTool({ taskTimeoutMillis: 15000 });
  return exiftool;
}

const c2pa = createC2pa();

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

// c2pa-node's `read()` is authoritative for detecting a real C2PA/JUMBF
// manifest (it parses the CAI box structure directly, cryptographic
// signature and all) — far more reliable than grepping exiftool tag names,
// which only catch it if exiftool happens to recognize the container.
// It is read/verify only; there is no public "remove manifest" call in the
// library, so removal still goes through exiftool's -all= pass below. We
// use c2pa-node before and after that pass to confirm the manifest is
// actually gone rather than just assuming it.
async function checkC2pa(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) return { present: false, checked: false };
  try {
    const manifest = await c2pa.read({ path: filePath, mimeType });
    return {
      present: !!manifest,
      checked: true,
      manifestCount: manifest ? Object.keys(manifest.manifests || {}).length : 0,
    };
  } catch (err) {
    // A malformed/partial manifest can throw rather than return null —
    // treat that as "something's there" rather than silently swallowing it.
    return { present: true, checked: true, error: String(err.message || err) };
  }
}

// exiftool-vendored 37 returns list-type tags (Artist, Creator, Keywords…) as
// arrays, and a single value can come back duplicated across mapped tags. Flatten
// to one display string so the renderer and the write-back contract stay stable.
function firstTagText(...candidates) {
  for (const candidate of candidates) {
    const flattened = []
      .concat(candidate ?? [])
      .map((piece) => String(piece).trim())
      .filter(Boolean);
    if (flattened.length) return [...new Set(flattened)].join(', ');
  }
  return '';
}

async function readMetadata(filePath) {
  const tool = getExiftool();
  const tags = await tool.read(filePath);
  const c2paInfo = await checkC2pa(filePath);
  return {
    author: firstTagText(tags.Artist, tags.Creator),
    copyright: firstTagText(tags.Copyright),
    description: firstTagText(tags.Description, tags.ImageDescription),
    software: firstTagText(tags.Software, tags.CreatorTool),
    // Stable Diffusion / ComfyUI / Midjourney commonly stash the full prompt
    // and generation params in these two PNG text chunks.
    parameters: firstTagText(tags.Parameters, tags['parameters']),
    comment: firstTagText(tags.Comment, tags.UserComment),
    gps: firstTagText(tags.GPSPosition),
    hasC2PA: c2paInfo.present,
  };
}

/**
 * @param {object} fields { author, company(copyright), comments(description),
 *   keywords, resetFingerprint }
 */
async function scrubAndWrite(inPath, outPath, fields = {}) {
  await fs.copyFile(inPath, outPath);
  const tool = getExiftool();

  const before = await checkC2pa(inPath);

  // -all= clears essentially everything: EXIF, IPTC, XMP, PNG text chunks
  // (including SD/ComfyUI "parameters"), ICC-adjacent tags, and the C2PA/
  // JUMBF box in formats exiftool understands (JPEG APP11 segment, PNG
  // caBX/jumb chunks). This is the actual strip pass.
  await tool.write(outPath, {}, ['-all=', '-overwrite_original']);

  // Optional: re-encode through sharp to change the file's perceptual
  // fingerprint/hash. This is a *privacy* feature distinct from metadata
  // stripping — it stops reverse-image-search/duplicate-match services from
  // linking a re-shared copy back to the original bytes. It does NOT touch
  // or attempt to defeat any invisible/statistical watermark baked into the
  // pixels (e.g. SynthID) — that's out of scope, same as agreed earlier.
  if (fields.resetFingerprint) {
    await resetFingerprint(outPath);
  }

  // Write-back pass: only fields the user actually filled in.
  const writeTags = {};
  if (fields.author) {
    writeTags.Artist = fields.author;
    writeTags.Creator = fields.author;
  }
  if (fields.company) writeTags.Copyright = fields.company;
  if (fields.comments) {
    writeTags.ImageDescription = fields.comments;
    writeTags.Description = fields.comments;
  }
  if (fields.keywords) {
    writeTags.Keywords = String(fields.keywords)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (Object.keys(writeTags).length > 0) {
    await tool.write(outPath, writeTags, ['-overwrite_original']);
  }

  const after = await checkC2pa(outPath);
  return {
    c2pa: {
      detectedBefore: before.present,
      detectedAfter: after.present,
      // If exiftool's -all= somehow missed it, flag it clearly rather than
      // reporting success.
      confirmedRemoved: before.present ? !after.present : null,
    },
  };
}

async function resetFingerprint(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);
  let img = sharp(buf);
  // Tiny, visually-imperceptible noise pass changes pixel values just enough
  // to change the encoded file's hash, then re-encode fresh (this also
  // happens to sweep up any residual container-level metadata sharp's
  // encoders don't carry forward).
  img = img.modulate({ brightness: 1 + (Math.random() * 0.004 - 0.002) });
  let reencoded;
  if (ext === '.png') reencoded = await img.png({ compressionLevel: 9 }).toBuffer();
  else if (ext === '.webp') reencoded = await img.webp({ quality: 92 }).toBuffer();
  else if (ext === '.tif' || ext === '.tiff') reencoded = await img.tiff().toBuffer();
  else reencoded = await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  await fs.writeFile(filePath, reencoded);
}

async function closeExiftool() {
  if (exiftool) {
    await exiftool.end();
    exiftool = null;
  }
}

module.exports = { readMetadata, scrubAndWrite, closeExiftool };
