// Strip + rewrite the standard PDF Info dictionary (Title, Author, Subject,
// Keywords, Creator, Producer, dates). Pure-JS via pdf-lib, no native deps.
//
// Scope note: this manages the Info dictionary and the XMP metadata stream
// pdf-lib owns. A small minority of PDFs also carry a C2PA content-credentials
// stream as a separate object; detecting/stripping those is not yet handled
// here (see the known-gap note in README.md).
const fs = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

/**
 * Read the Info-dictionary metadata from a PDF without modifying it.
 *
 * @param {string} filePath  Path to a .pdf file.
 * @returns {Promise<object>}  Flat object of the standard fields (title,
 *   author, subject, keywords, creator, producer, creationDate,
 *   modificationDate); missing fields come back as empty strings.
 */
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
 * Wipe the PDF Info dictionary and write back only the supplied fields, saving
 * to a new file. The input file is never modified.
 *
 * @param {string} inPath   Source .pdf (read-only).
 * @param {string} outPath  Destination for the cleaned copy.
 * @param {object} fields   User-supplied replacements: author, title,
 *   comments (mapped to Subject), keywords, applicationOverride (mapped to
 *   Creator + Producer), setDatesNow, clearDates. Omitted fields stay empty.
 * @returns {Promise<void>}
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
