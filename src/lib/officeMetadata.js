// Strip + rewrite metadata inside OOXML zip containers (docx/pptx/xlsx).
// core.xml   -> dublin-core props (creator, lastModifiedBy, title, subject, description, keywords, dates)
// app.xml    -> Application, AppVersion, Company, Manager
// custom.xml -> arbitrary custom properties (often where odd tool fingerprints hide) -> deleted entirely
// word/document.xml (docx only) -> strip w:rsid* attributes (per-edit-session fingerprints)
// settings.xml -> strip <w:rsids> block

const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

const CORE_PATH = 'docProps/core.xml';
const APP_PATH = 'docProps/app.xml';
const CUSTOM_PATH = 'docProps/custom.xml';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
});
const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: false,
});

function getEntryText(zip, entryPath) {
  const entry = zip.getEntry(entryPath);
  if (!entry) return null;
  return zip.readAsText(entry);
}

async function readMetadata(filePath) {
  const buf = await fs.readFile(filePath);
  const zip = new AdmZip(buf);

  const coreXml = getEntryText(zip, CORE_PATH);
  const appXml = getEntryText(zip, APP_PATH);
  const hasCustom = !!zip.getEntry(CUSTOM_PATH);

  const metadata = { core: {}, app: {}, hasCustomProperties: hasCustom };

  if (coreXml) {
    const parsed = parser.parse(coreXml);
    const props = parsed['cp:coreProperties'] || {};
    metadata.core = {
      creator: props['dc:creator'] || '',
      lastModifiedBy: props['cp:lastModifiedBy'] || '',
      title: props['dc:title'] || '',
      subject: props['dc:subject'] || '',
      description: props['dc:description'] || '',
      keywords: props['cp:keywords'] || '',
      category: props['cp:category'] || '',
      created: props['dcterms:created']?.['#text'] || props['dcterms:created'] || '',
      modified: props['dcterms:modified']?.['#text'] || props['dcterms:modified'] || '',
    };
  }

  if (appXml) {
    const parsed = parser.parse(appXml);
    const props = parsed.Properties || {};
    metadata.app = {
      application: props.Application || '',
      appVersion: props.AppVersion || '',
      company: props.Company || '',
      manager: props.Manager || '',
    };
  }

  return metadata;
}

/**
 * @param {string} inPath
 * @param {string} outPath
 * @param {object} fields  { author, company, title, comments, lastModifiedBy, keywords, subject, category, manager, setDatesNow, clearDates }
 */
async function scrubAndWrite(inPath, outPath, fields = {}) {
  const buf = await fs.readFile(inPath);
  const zip = new AdmZip(buf);

  // 1. custom.xml — delete entirely, this is the most common place third-party
  //    tools stash their own fingerprint fields.
  if (zip.getEntry(CUSTOM_PATH)) {
    zip.deleteFile(CUSTOM_PATH);
    // also remove its declaration from [Content_Types].xml and _rels if present
    stripCustomPropsReferences(zip);
  }

  // 2. core.xml — wipe everything, then write back only what the user supplied.
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const coreObj = {
    'cp:coreProperties': {
      '@_xmlns:cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
      '@_xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      '@_xmlns:dcmitype': 'http://purl.org/dc/dcmitype/',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'dc:creator': fields.author || '',
      'cp:lastModifiedBy': fields.lastModifiedBy || fields.author || '',
      'dc:title': fields.title || '',
      'dc:subject': fields.subject || '',
      'dc:description': fields.comments || '',
      'cp:keywords': fields.keywords || '',
      'cp:category': fields.category || '',
    },
  };
  if (!fields.clearDates) {
    const stamp = fields.setDatesNow ? nowIso : '';
    if (stamp) {
      coreObj['cp:coreProperties']['dcterms:created'] = {
        '@_xsi:type': 'dcterms:W3CDTF',
        '#text': stamp,
      };
      coreObj['cp:coreProperties']['dcterms:modified'] = {
        '@_xsi:type': 'dcterms:W3CDTF',
        '#text': stamp,
      };
    }
  }
  const coreXmlOut =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + builder.build(coreObj);
  zip.updateFile(CORE_PATH, Buffer.from(coreXmlOut, 'utf-8'));

  // 3. app.xml — wipe Application/AppVersion/Company/Manager, write back user values only.
  const appEntry = zip.getEntry(APP_PATH);
  if (appEntry) {
    const parsed = parser.parse(zip.readAsText(appEntry));
    const props = parsed.Properties || {};
    props.Application = fields.applicationOverride || '';
    props.AppVersion = '';
    props.Company = fields.company || '';
    props.Manager = fields.manager || '';
    delete props.DocSecurity;
    parsed.Properties = props;
    const appXmlOut =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + builder.build(parsed);
    zip.updateFile(APP_PATH, Buffer.from(appXmlOut, 'utf-8'));
  }

  // 4. Strip per-session rsid fingerprints from every part's XML (docx/pptx/xlsx
  //    all can carry these on various elements) and the settings.xml rsids block.
  const entries = zip.getEntries();
  for (const entry of entries) {
    if (!entry.entryName.endsWith('.xml')) continue;
    if (entry.entryName === CORE_PATH || entry.entryName === APP_PATH) continue;
    let partXml = zip.readAsText(entry);
    if (!partXml.includes('w:rsid') && !partXml.includes('<w:rsids')) continue;
    partXml = partXml.replace(/\s+w:rsid[A-Za-z]*="[^"]*"/g, '');
    partXml = partXml.replace(/<w:rsids>[\s\S]*?<\/w:rsids>/g, '');
    zip.updateFile(entry.entryName, Buffer.from(partXml, 'utf-8'));
  }

  await fs.writeFile(outPath, zip.toBuffer());
}

function stripCustomPropsReferences(zip) {
  const ctPath = '[Content_Types].xml';
  const ctEntry = zip.getEntry(ctPath);
  if (ctEntry) {
    let contentTypesXml = zip.readAsText(ctEntry);
    contentTypesXml = contentTypesXml.replace(
      /<Override[^>]*PartName="\/docProps\/custom\.xml"[^>]*\/>/,
      ''
    );
    zip.updateFile(ctPath, Buffer.from(contentTypesXml, 'utf-8'));
  }
  const relsPath = '_rels/.rels';
  const relsEntry = zip.getEntry(relsPath);
  if (relsEntry) {
    let relsXml = zip.readAsText(relsEntry);
    relsXml = relsXml.replace(/<Relationship[^>]*Target="docProps\/custom\.xml"[^>]*\/>/, '');
    zip.updateFile(relsPath, Buffer.from(relsXml, 'utf-8'));
  }
}

module.exports = { readMetadata, scrubAndWrite };
