# Compass Clean

Electron desktop app: strip embedded metadata from DOCX/PPTX/XLSX/PDF/images, then
write back only the fields the user explicitly fills in.

[![CI](https://github.com/rajeevyadav/cleancompass/actions/workflows/ci.yml/badge.svg)](https://github.com/rajeevyadav/cleancompass/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/node-20.x-339933)

📥 **[Download &amp; project site](https://rajeevyadav.github.io/cleancompass/)** — Windows installer, macOS, and Linux builds.

## What this project is / is not

**Is:** a local, offline desktop tool that removes identifying metadata
(authors, timestamps, editing fingerprints, generation prompts, C2PA content
credentials) from documents and images before you share them, writing output
to a `.cleaned.<ext>` copy and never touching the original.

**Is not:** a watermark remover. It does not touch or attempt to defeat
invisible pixel-level watermarks (e.g. Google SynthID) or statistical
text-detector watermarks — no reliable public removal exists for those and they
are out of scope by design. It is not a cloud service; nothing leaves your
machine.

Open source under the MIT license.

## What it strips

| Format | Stripped | Library |
|---|---|---|
| docx/pptx/xlsx | `docProps/core.xml` (author, dates, subject...), `docProps/app.xml` (Application, Company, Manager), `docProps/custom.xml` (deleted entirely), `w:rsid*` per-edit-session fingerprints in every XML part, `<w:rsids>` block in settings.xml | `adm-zip` + `fast-xml-parser`, no native deps |
| pdf | Info dict (Title/Author/Subject/Keywords/Creator/Producer) | `pdf-lib`, pure JS |
| png/jpg/webp/tiff | EXIF/IPTC/XMP, PNG text chunks (this is where Stable Diffusion/ComfyUI/Midjourney embed the full prompt + generation params as `parameters`), C2PA/JUMBF manifest | `exiftool-vendored` for the actual strip, `c2pa-node` (official Content Authenticity Initiative library) to detect the manifest before/after and confirm removal actually worked |

### C2PA handling (added)

`c2pa-node` is read/verify only — there's no public "remove manifest" call in
that library — so removal still goes through exiftool's `-all=` pass. What
`c2pa-node` adds is a real, spec-correct detector: it parses the actual JUMBF
box structure rather than guessing from exiftool tag names, so the app can
tell you definitively whether a manifest was present and whether it's
actually gone after stripping, instead of assuming. If a file still shows a
manifest after processing, the UI flags it in red rather than silently
reporting success.

### Fingerprint reset (added, images only, opt-in checkbox)

A `sharp`-based re-encode pass that changes the file's hash so
reverse-image-search/duplicate-match services can't link a re-shared copy
back to the original bytes. This is a distinct privacy feature from metadata
stripping — it does **not** touch or attempt to defeat any invisible
pixel-level watermark (e.g. Google's SynthID). No reliable public
removal method exists for those, and it's out of scope by design, same as
agreed at project start.

### Known gap

A small minority of PDFs carry a C2PA manifest as well — `src/lib/pdfMetadata.js`
still only manages the standard Info dict via `pdf-lib` and doesn't yet run
the same `c2pa-node` detect/verify pass images get. Flag if you hit one.

## License

Released under the [MIT License](LICENSE) — free to use, modify, and
distribute, with attribution and no warranty. Copyright (c) 2026 Rajeev Yadav.

## Setup

```bash
cd cleancompass
npm install
npm start
```

First `npm install` will pull `exiftool-vendored`, which downloads the
platform-appropriate exiftool binary — needs network access once.

## Test checklist for the implementor

1. **DOCX round-trip**: open a .docx that was saved by Word, check
   File > Info shows an Author/Company. Run it through the app with just
   an Author name filled in. Re-open output in Word — Author should be the
   new name only, Company/Manager blank, and no rsid artifacts visible if
   you inspect `word/document.xml` inside the .docx zip.
2. **AI-exported PDF**: any PDF exported from a chat/AI tool. Check
   Producer/Creator strings via `exiftool file.pdf` before, confirm blank
   (or your override) after.
3. **Stable Diffusion PNG**: a PNG with an embedded `parameters` tEXt chunk
   (`exiftool -Parameters file.png` to confirm it's there first). Confirm
   it's gone after processing — this is the main "AI trace" case for images.
3a. **C2PA-signed image**: a DALL-E/Firefly/Sora output with real Content
   Credentials (an Adobe test image works — see c2pa-node's own test fixtures
   or use the c2patool sample assets). Confirm the app's file-list note reads
   "C2PA manifest detected and removed (verified)" and not the red
   still-present warning.
3b. **Fingerprint reset checkbox**: process the same image with and without
   it checked, diff the two output file hashes — they should differ, and the
   image should look visually identical.
4. **Batch run**: select 5+ mixed-format files at once, one output folder,
   confirm all get `.cleaned.ext` siblings and none silently fail.
5. **Blank-fields case**: run with every text field empty — confirm output
   files have empty/absent metadata rather than any placeholder text.
6. **Original untouched**: confirm the source file's mtime/content is
   unchanged after processing (app only ever writes to `<name>.cleaned.<ext>`
   in the chosen output folder).

## Known limitations (by design, see project scope)

- Does not touch AI text-detector statistical watermarks in generated prose —
  no reliable public extraction/removal method exists for most schemes, so
  this app doesn't claim to do it.
- Drag-and-drop may fall back to the file picker on newer Electron versions
  where `File.path` isn't exposed to the renderer for sandboxing reasons —
  functionally equivalent, just an extra click.
- `electron-builder` packaging config in `package.json` is a starting point,
  not verified — `exiftool-vendored`'s and `c2pa-node`'s native binaries
  need to end up unpacked from asar (already set via `asarUnpack`) for the
  packaged app to find them at runtime. Test a packaged build before
  shipping to anyone else.
- `build/icon.png` (1024px source in `build/icon.svg`) covers Linux/general
  use. Windows needs a `.ico` and macOS needs a `.icns` generated from the
  same source before `npm run dist` will produce a properly-iconed
  installer on those platforms — `npx electron-icon-builder --input=build/icon.svg --output=build` is the quickest way to generate both from the SVG.

## Contribution & governance

This repository is governed by a strict, non-negotiable engineering policy.
Before opening a branch or pull request, read
[GOVERNANCE.md](GOVERNANCE.md) — it defines branching, Conventional-Commit /
Class-C commit rigor, signed-commit and branch-protection requirements, the
AI-authorship prohibition, versioning, and the mandatory PR checklist.
Architecture Decision Records live in [docs/adr/](docs/adr/).
