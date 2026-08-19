# Strict Repository Governance & AI Prohibition Policy

**Version:** 1.0
**Status:** Non-negotiable
**Goal:** Prevent the need to "fix issues later" through extreme upfront discipline.
**Author:** Rajeev Yadav
**Date:** 2026-08-19

This document defines the mandatory rules for this repository. All contributors (including the repository owner) must follow these rules. Softening any rule requires an explicit written amendment approved through the normal pull-request process.

---

## 1. Absolute Rules (Violation = Immediate Rejection / Force-Revert)

### 1.1 Zero AI Co-authorship or Bot Commits
- No commit may contain any `Co-authored-by:` trailer that mentions Copilot, Claude, Grok, Cursor, ChatGPT, Gemini, Devin, or any other AI/LLM/agent/tool.
- No commit may be authored by any bot account, GitHub App, or service account except the official CI bot (and only for non-code automation files).
- Only explicitly authorized human GitHub usernames may push or merge. The list is maintained in `CODEOWNERS` and enforced by branch protection rules.
- Any PR or commit that shows AI fingerprints (generic variable names, over-helpful comments, "as an AI...", speculative TODOs, etc.) is automatically rejected.

### 1.2 Branch Protection (Applies Even to Solo Maintainers)
- `main` and all release branches are protected with:
  - Require pull request before merging
  - Require all status checks to pass
  - Require at least one approving review (self-review is allowed only if the full checklist is completed in writing in the PR)
  - Require linear history (rebase or squash only)
  - Require signed commits (GPG or SSH)
  - Dismiss stale reviews
  - Restrict who can push (only listed humans)
  - Force-push completely disabled — even for administrators
- No direct pushes to protected branches under any circumstances.

### 1.3 Mandatory CI Pipeline
- CI runs on every pull request and every push to protected branches.
- Required checks (merge is blocked if any fail):
  - Linters + formatters
  - Static analysis / SAST
  - Unit + integration tests
  - Coverage thresholds (threshold can only increase, never decrease without explicit approval)
  - Spelling / grammar / documentation quality
  - Secret scanning
  - Dependency vulnerability scan (critical/high CVEs fail the build)
  - License compliance scan
  - Commit message validation
  - (Recommended) Heuristic detection of common AI comment patterns and generic variable names
- CI is never optional or skippable.

### 1.4 No Personal or Internal Development Artifacts
- Do not commit personal details (names, emails, phone numbers, addresses, private notes, etc.).
- Do not commit internal development documents such as directives, internal reports, meeting notes, personal to-do lists, or similar material unless explicitly authorized and required for the project.
- The only authorized contact or ownership information that may appear is what is deliberately placed in `CODEOWNERS`, `LICENSE`, or the project's public README under controlled review.

---

## 2. Branching Strategy

### Allowed branches
- `main` — the single source of truth. Always releasable.
- `feature/<short-description>` — for new work
- `fix/<short-description>` — for bug fixes
- `chore/<short-description>` — for maintenance, tooling, docs
- `release/vX.Y.Z` — only when preparing a formal release (optional, used for larger projects)

### Rules
- All work must be done on a short-lived branch created from the latest `main`.
- Branch names must be lowercase, use hyphens, and clearly indicate purpose.
- No long-lived feature branches. Merge or close within a reasonable time.
- Never commit directly to `main`.
- Never create branches named `dev`, `develop`, `staging`, `tmp`, `test`, or similar.
- After a pull request is merged, delete the source branch.
- Release branches (if used) are created only from `main` and are protected.

---

## 3. Versioning Rules (Semantic Versioning)

This repository follows **Semantic Versioning 2.0.0** strictly.

### Starting version
- The first meaningful version of any project **must start at `0.1.0`** (or `1.0.0` if it is already considered production-ready).
- **`0.0.0`, `0.0.1`, `v0.0.0`, etc. are forbidden.**

### Version format
- Always `MAJOR.MINOR.PATCH` (e.g. `1.4.2`)
- Optional pre-release suffixes are allowed only when explicitly needed: `1.4.2-rc.1`, `1.4.2-beta.3`
- Git tags must be prefixed with `v` (example: `v1.4.2`)

### When to bump
| Change type                        | Bump     | Example          |
|------------------------------------|----------|------------------|
| Breaking change / incompatible API | MAJOR    | 1.4.2 → 2.0.0    |
| New feature (backward compatible)  | MINOR    | 1.4.2 → 1.5.0    |
| Bug fix / internal change          | PATCH    | 1.4.2 → 1.4.3    |

### Rules
- Version bumps happen only through a dedicated pull request (or release PR).
- The version must be updated in all relevant places in the same PR (`package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION` file, etc.).
- Every release must produce a Git tag `vX.Y.Z` created by CI or by a controlled release process.
- Changelog must be updated in the same PR that bumps the version.
- Never invent versions. Never skip numbers without justification.

---

## 4. Commit Message & Change Standard (Class-C / High-Assurance Rigor)

Every commit message must follow this structure:

```
<type>(<scope>): <imperative short description>

<body – why this change is needed, what problem it solves,
 risk/impact if wrong, and any relevant edge cases>

<footer – breaking changes, related issues/tickets, test evidence>
```

**Additional rules:**
- Body must explain *reasoning* and *risk*, not just "what".
- One logical change per commit. No "WIP", "fix stuff", "update", "misc".
- Every non-trivial commit must reference an issue/ticket number.
- Signed commits only.
- No AI tool signatures of any kind.

---

## 5. Pull Request Standard (Senior / Principal Engineer Bar)

### Required content in every PR
- Clear problem statement
- Concrete acceptance criteria
- Description of testing performed (what, how, results)
- Explicit discussion of risk / failure modes / migration impact
- Reference to related issues/tickets

### Mandatory PR Checklist (Author must complete)
```
- [ ] No AI co-author or tool signatures present
- [ ] Naming is domain-specific and human (not generic AI style)
- [ ] Every non-obvious decision has an ADR or is explained in the PR
- [ ] Risk / failure modes discussed
- [ ] Tests cover the change + relevant edge cases
- [ ] Spelling/grammar checked in docs and user-facing strings
- [ ] No secrets, no unpinned dependencies
- [ ] No personal details or unauthorized internal documents
- [ ] Commit messages follow the Class-C style and reference issues
- [ ] Changelog updated (or conventional-commit generation reviewed)
- [ ] Version bump (if applicable) follows the versioning rules
```

Code review must verify the checklist items, not just "looks good".

---

## 6. README & Project Metadata

`README.md` must always contain, in this order:

1. Project title + one-sentence description
2. Status / maturity badges (build, coverage, license, language, etc.)
3. Clear "What this project is / is not"
4. License section (link to `LICENSE`)
5. How to build / run / test / set up the environment
6. Contribution & governance pointer (link to this file)

Language, license, and badge sections are living documentation and must be updated in the same PR that changes them. Prefer CI-generated badges where possible.

---

## 7. Code Style & Naming – Human, Domain-Specific, Anti-AI

- Names must be domain-meaningful and project-specific.
- Forbidden patterns: `data`, `result`, `temp`, `helper`, `util`, `processData`, `handleRequest`, `getSomething`, `foo`, `bar`, or paragraph-length identifiers.
- Prefer short, precise domain vocabulary.
- Comments explain *why* or non-obvious constraints only. Never restate the obvious.
- No AI-generated "helpful" comments or speculative TODOs.
- **Exception:** Pure AI/ML algorithm modules may use standard ML naming *inside* the algorithm boundary only. Everything else remains human/project style.

---

## 8. Documentation, Spelling & Quality Gates

- Every PR that touches docs, comments, user-facing strings, or the README must pass spelling/grammar checks.
- Code quality, complexity, and duplication thresholds are enforced in CI.
- No "AI will fix later" or "temporary" code unless it is linked to a tracked issue with an owner and expiry date.

---

## 9. AI Usage Policy (Narrow Exception Only)

AI tools may be used *only* when **both** conditions are met:

1. The work is pure algorithmic / mathematical / ML model code that is clearly isolated, **and**
2. The human author has fully reviewed, understood, rewritten naming and style to project standards, and takes complete ownership.

All other code, tests, documentation, commit messages, and PR text must be human-authored.
If the exception is used, the PR description must explicitly declare it and state what was rewritten by the human.

---

## 10. Supply-Chain, Secrets & Dependency Hygiene

- All production dependencies must be pinned to exact versions (no `^` or `~` ranges).
- Dependabot / Renovate is allowed only for security updates; every update still requires full senior review + CI.
- CI fails on known critical/high CVEs or unmaintained dependencies.
- SBOM generation is required on every release.
- **Zero tolerance for secrets:**
  - Pre-commit + CI secret scanning (gitleaks, trufflehog, or GitHub secret scanning).
  - No `.env`, API keys, tokens, or private keys may ever be committed (even in history).
  - Discovery forces rejection and history rewrite before merge is allowed.
- Secrets must live in a proper secrets manager or GitHub encrypted secrets.

---

## 11. Traceability, ADRs & Release Discipline

- Architecture Decision Records (ADRs) are required for any non-obvious design choice, technology selection, or deviation from standards. ADRs live in `docs/adr/` and are reviewed like code.
- Semantic Versioning is mandatory (see Section 3).
- Releases only from protected tags created by CI after all checks pass.
- Release notes must include a risk/impact summary.
- Changelog must be updated in the same PR (or generated from conventional commits with human review).

---

## 12. Local Pre-Commit Enforcement

Mandatory pre-commit hooks for:
- Commit message format + length + risk language
- Trailing whitespace, end-of-file, large files
- Secret detection
- Basic linting / formatting
- Detection of AI co-author trailers

Developers must install the hooks. CI re-validates everything.

---

## 13. Developer Environment Reproducibility

- Exact tool versions must be documented (or locked via Dev Container, Nix, asdf, mise, etc.).
- A single command (`make setup` or equivalent) must bring a new machine to a known-good state.
- CI must use the same toolchain versions as local development.

---

## 14. Governance of the Governance

- This policy lives in the repository and can only be changed via the same pull-request process.
- Any temporary exception requires a written, time-boxed waiver with an owner and expiry date.
- After any incident, or at least quarterly, the policy is reviewed for silent erosion.

---

## Implementation Checklist for a Brand-New Repository

- [ ] Create repository → immediately enable full branch protection on `main`
- [ ] Add `CODEOWNERS` with only authorized human usernames
- [ ] Add GitHub Actions (or equivalent) CI with all required checks
- [ ] Add pre-commit configuration and require installation
- [ ] Add commit-message validation (Conventional Commits + body rigor)
- [ ] Add secret scanning and dependency vulnerability scanning
- [ ] Seed `README.md` with the required sections + badges
- [ ] Add `LICENSE` file
- [ ] Create `docs/adr/` directory
- [ ] Place this file as `GOVERNANCE.md` and link it from the README
- [ ] Require signed commits
- [ ] Set up Semantic Versioning starting at `0.1.0` or `1.0.0` (never `0.0.0`)
- [ ] (Recommended) Add a simple heuristic job that flags common AI patterns

---

**This policy is intentionally stricter than typical open-source practice.**
It exists because the repository is intended to meet high-assurance engineering discipline.
Any softening must be an explicit, reviewed amendment.
