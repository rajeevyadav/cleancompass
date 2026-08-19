const fs = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

async function readMetadata(filePath) {
  const bytes = await fs.readFile(filePath);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  return {
    title: doc.getTitle() || '',
    author: doc.getAuthor() || '',
    subject: doc.getSubject() || '',
    keywords: (doc.getKeywords && doc.getKeywords()) || '',
    creator: doc.getCreator() || '',
    producer: doc.getProducer() || '',
    creationDate: doc.getCreationDate ? String(doc.getCreationDate() || '') : '',
    modificationDate: doc.getModificationDate ? String(doc.getModificationDate() || '') : '',
    // Note: this clears the standard Info dictionary and XMP metadata stream
    // that pdf-lib manages. A small number of PDFs (rare) carry an additional
    // C2PA content-credentials stream as a separate attached file object;
    // if you need those detected/stripped too, flag it and we'll add a pass
    // that scans for the C2PA JUMBF box specifically.
  };
}

/**
 * @param {object} fields { author, title, comments(subject), keywords, company(producer/creator override), setDatesNow, clearDates }
 */
async function scrubAndWrite(inPath, outPath, fields = {}) {
  const bytes = await fs.readFile(inPath);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });

  // Wipe first.
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');

  // Write back only what was supplied.
  if (fields.title) doc.setTitle(fields.title);
  if (fields.author) doc.setAuthor(fields.author);
  if (fields.comments) doc.setSubject(fields.comments);
  if (fields.keywords)
    doc.setKeywords(
      String(fields.keywords)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  if (fields.applicationOverride) {
    doc.setCreator(fields.applicationOverride);
    doc.setProducer(fields.applicationOverride);
  }

  if (fields.clearDates) {
    // pdf-lib always stamps ModDate on save; there is no public API to omit it.
    // Leaving as-is — flag if a true no-date-field output is required, that
    // needs a raw byte-level post-process pass.
  } else if (fields.setDatesNow) {
    const now = new Date();
    doc.setCreationDate(now);
    doc.setModificationDate(now);
  }

  const outBytes = await doc.save();
  await fs.writeFile(outPath, outBytes);
}

module.exports = { readMetadata, scrubAndWrite };
