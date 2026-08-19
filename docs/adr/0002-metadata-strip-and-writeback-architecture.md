# ADR-0002: Per-format strip-then-writeback metadata architecture

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Rajeev Yadav

## Context

Compass Clean must remove embedded metadata from several unrelated container
formats (OOXML zip packages, PDF, and raster images) and then write back only
the fields a user explicitly supplies. Each format stores metadata in a
fundamentally different structure, and no single library covers all of them
safely.

## Decision

We isolate each format behind its own module in `src/lib/`, each exposing the
same two-function contract (`readMetadata`, `scrubAndWrite`):

- `officeMetadata.js` — `adm-zip` + `fast-xml-parser` to edit `docProps/*.xml`
  and strip per-session `w:rsid*` fingerprints. No native dependency.
- `pdfMetadata.js` — `pdf-lib` (pure JS) to clear and rewrite the Info dict.
- `imageMetadata.js` — `exiftool-vendored` for the actual `-all=` strip, plus
  `c2pa-node` as an authoritative before/after detector of C2PA/JUMBF
  manifests, and an optional `sharp` re-encode to reset the perceptual hash.

Every path follows strip-first, then write-back-only-supplied-fields, and never
mutates the source file — output is always a `<name>.cleaned.<ext>` sibling.

## Consequences

- Adding a format is a new self-contained module implementing the same
  contract, with no cross-format coupling.
- Known gaps are explicit and documented (PDF C2PA manifests are not yet
  detected; pixel-level watermarks such as SynthID are out of scope by design).
- `exiftool-vendored` and `c2pa-node` carry native binaries that must be
  unpacked from the Electron asar at package time.

## Alternatives considered

- **A single generic metadata library:** rejected — none reliably handles
  OOXML `rsid` fingerprints, PDF Info dicts, and C2PA manifests together.
- **Mutating files in place:** rejected — unacceptable data-loss risk; the
  original must remain byte-for-byte untouched.
