# Waiver: build-tooling CVEs pending electron-builder major upgrade

- **Waiver ID:** WVR-2026-08-19-001
- **Governance clause:** GOVERNANCE.md §14 (time-boxed exception), §10 (supply chain)
- **Owner:** Rajeev Yadav (@rajeevyadav)
- **Granted:** 2026-08-19
- **Expires:** 2026-11-17 (90 days)
- **Status:** Active

## Scope

This waiver covers **build-only tooling** CVEs that do not ship in the packaged
application. All production (shipped) dependencies have been upgraded to patched
versions and are clean at the `high` level; CI hard-fails on any high/critical
CVE in production deps (`npm audit --omit=dev --audit-level=high`).

## Resolved (no longer waived)

The production dependency CVEs originally covered by this waiver have been fixed
permanently:

| Package | Was | Now | Notes |
|---|---|---|---|
| `adm-zip` | 0.5.18 | 0.6.0 | OOXML strip/write-back re-verified by `test/officeMetadata.test.js`. |
| `exiftool-vendored` | 28.8.0 | 37.2.0 | Image strip re-verified by `test/imageMetadata.test.js`. v37 returns list-type tags as arrays; handled by `firstTagText()` in `imageMetadata.js`. |
| `fast-xml-parser` | 4.5.7 | 5.11.0 | Core/app XML round-trip re-verified by tests. |
| `tar` (transitive) | 6.x | 7.5.22 | Critical CVE; fixed via `overrides`. |
| `sharp` (nested) | 0.34.3 | 0.35.3 | Fixed via `overrides`. |

## Still waived (build-only, does NOT ship)

The `electron-builder` packaging chain and the dev `electron` runtime carry high
CVEs, exposed only on the build host, never in the shipped binary:

`electron-builder`, `app-builder-lib`, `dmg-builder`, `electron-publish`,
`electron-builder-squirrel-windows`, `builder-util`, `builder-util-runtime`,
`extract-zip`, dev `electron`.

## Remediation plan (must complete before 2026-11-17)

1. Branch `chore/electron-builder-upgrade` from `main`.
2. Upgrade `electron-builder` to the current major and the dev `electron`
   runtime; resolve the transitive `extract-zip`/`builder-util*` advisories.
3. Produce and smoke-test a packaged build on Windows, macOS, and Linux —
   confirm `exiftool-vendored` and `c2pa-node` native binaries unpack from asar
   and run.
4. Once green, make the triage audit step in `ci.yml` blocking
   (remove `|| true`) and close this waiver.

## Review

If remediation is not complete by the expiry date, this waiver must be either
formally renewed (new dated waiver, new owner sign-off) or the build-tooling
gate tightened — silent lapse is a §14 violation.
