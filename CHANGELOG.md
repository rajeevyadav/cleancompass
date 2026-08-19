# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(GOVERNANCE.md §3).

## [Unreleased]

### Added
- Repository governance scaffolding: `GOVERNANCE.md`, `CODEOWNERS`, `LICENSE`,
  CI pipeline, commit-message validation, pre-commit hooks, PR template, and
  `docs/adr/` (Architecture Decision Records).
- Test suite covering all three format libraries: strip round-trips,
  blank-fields (no placeholder leakage), date stamping, image fingerprint
  reset, C2PA-absent path, and the source-file-untouched invariant.

### Changed
- Renamed metadata libraries to domain-specific names
  (`officeMetadata.js`, `pdfMetadata.js`, `imageMetadata.js`) and revised
  identifiers to satisfy GOVERNANCE.md §7.
- Upgraded production dependencies to patched versions: `adm-zip` 0.5→0.6,
  `exiftool-vendored` 28→37, `fast-xml-parser` 4→5. Added `overrides` for
  transitive `tar` 7.5.22 and `sharp` 0.35.3. Production dependency tree is now
  clean of high/critical CVEs.

- Adopted the MIT license for public release (previously proprietary).
- Added `.gitattributes` to normalize line endings to LF across platforms.

### Fixed
- `imageMetadata.readMetadata` now flattens list-type exiftool tags
  (`exiftool-vendored` 37 returns `Artist`/`Creator` as arrays) to a single
  display string via `firstTagText`, preserving the renderer contract.

## [0.1.0] - 2026-08-19

### Added
- Initial Compass Clean desktop application: strip and rewrite document and
  image metadata (DOCX/PPTX/XLSX, PDF, PNG/JPG/WebP/TIFF), C2PA manifest
  detection and verified removal, and optional image fingerprint reset.
