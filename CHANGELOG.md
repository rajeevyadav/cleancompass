# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(GOVERNANCE.md §3).

## [Unreleased]

## [1.1.0] - 2026-08-19

First-build review corrections (Directive D-002) plus a launch-crash fix.

**Risk / impact summary (§11):** Addresses a critical defect — the packaged
1.0.0 app could crash on launch (Windows Just-In-Time debugger) when a native
dependency failed to load at require time. Native modules (`exiftool-vendored`,
`c2pa-node`, `sharp`) now load lazily inside try/catch, and a global
main-process `uncaughtException` handler shows a readable dialog instead of a
hard crash. Remaining residual risks are unchanged from 1.0.0 (PDF C2PA gap;
build-tooling CVE waiver). No data-loss risk: originals are still never
modified, covered by tests.

### Added
- Before/After metadata comparison per file: expandable panel showing every
  field from the format library, with blank fields shown as "— none —" so a
  cleared field is visibly confirmed (D-002 #2).
- Dual-theme (Light/Dark) semantic color-token system with a header toggle,
  following the OS preference by default and persisting the user's choice.
- Populated Help menu — About (version + description), a usage note, and a
  README link — and the running version shown in the window title (D-002 #6).

### Changed
- Cleaned files now save next to their source by default; choosing an output
  folder is an optional override and no longer required to run (D-002 #3).
- Raised UI contrast to WCAG AA and removed the redundant window scrollbar so
  only panels scroll (D-002 #1, #4).
- Windows installer is now an assisted NSIS installer with a proper
  uninstaller and Add/Remove Programs entry.

### Fixed
- Hardened main-process startup against native-module load failures (the 1.0.0
  launch crash).
- Replaced example placeholder text that used a real name/company with generic
  examples; confirmed the persisted-profile pre-fill was a local testing
  artifact, not a code default (D-002 #5).

## [1.0.0] - 2026-08-19

First production-ready release, promoted from 0.1.0 under GOVERNANCE.md §3.

**Risk / impact summary (§11):** No runtime behavior changes from 0.1.0 —
this release is a maturity declaration plus the governance, tooling, test,
and dependency work below. Residual risks carried into 1.0.0: PDF-embedded
C2PA manifests are not yet detected (`pdfMetadata.js`, tracked in README);
`electron-builder` packaging is configured but not yet verified on a packaged
build across all platforms; and build-only tooling CVEs remain under a
time-boxed waiver (`docs/waivers/`, expires 2026-11-17). No data-loss risk:
the source file is never modified and this is covered by tests.

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
