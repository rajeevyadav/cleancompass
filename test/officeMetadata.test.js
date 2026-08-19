// Starter test suite (node --test). Exercises the OOXML strip/write-back
// round-trip on a minimal in-memory docx so CI has a real behavioural check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');

const { readMetadata, scrubAndWrite } = require('../src/lib/officeMetadata');

// Build the smallest zip that looks like an OOXML package carrying author and
// company metadata plus an rsid fingerprint and a custom-properties part.
function buildSampleDocx() {
  const zip = new AdmZip();
  zip.addFile(
    'docProps/core.xml',
    Buffer.from(
      '<?xml version="1.0"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        '<dc:creator>Original Author</dc:creator>' +
        '<cp:lastModifiedBy>Original Editor</cp:lastModifiedBy>' +
        '</cp:coreProperties>'
    )
  );
  zip.addFile(
    'docProps/app.xml',
    Buffer.from(
      '<?xml version="1.0"?>' +
        '<Properties><Application>Microsoft Office Word</Application>' +
        '<Company>Original Company</Company></Properties>'
    )
  );
  zip.addFile('docProps/custom.xml', Buffer.from('<Properties/>'));
  zip.addFile(
    'word/document.xml',
    Buffer.from('<w:document><w:p w:rsidR="00AB12CD"><w:r/></w:p></w:document>')
  );
  return zip.toBuffer();
}

test('scrubAndWrite clears author/company and rsid, keeps only supplied fields', async () => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compass-clean-'));
  const inPath = path.join(workDir, 'sample.docx');
  const outPath = path.join(workDir, 'sample.cleaned.docx');
  await fs.writeFile(inPath, buildSampleDocx());

  await scrubAndWrite(inPath, outPath, { author: 'Cleaned Name' });

  const metadata = await readMetadata(outPath);
  assert.equal(metadata.core.creator, 'Cleaned Name');
  assert.equal(metadata.app.company, '');
  assert.equal(metadata.hasCustomProperties, false);

  const cleaned = new AdmZip(await fs.readFile(outPath));
  const documentXml = cleaned.readAsText(cleaned.getEntry('word/document.xml'));
  assert.ok(!documentXml.includes('w:rsidR'), 'rsid fingerprint should be stripped');

  await fs.rm(workDir, { recursive: true, force: true });
});
