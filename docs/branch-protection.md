# Server-side settings to apply on GitHub

These controls **cannot** be enforced by files in the repository — they are
GitHub account/repo settings. Apply them once, in the GitHub UI or via the API,
to satisfy GOVERNANCE.md §1.2, §1.3, and §4. Files in this repo (CI workflow,
CODEOWNERS, PR template) are the other half; they only take effect once these
server-side rules point at them.

## 1. Branch protection for `main` (§1.2)

GitHub → Settings → Branches → Add branch ruleset (or classic protection) for
`main`:

- [x] Require a pull request before merging
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required checks (add each once it has run at least once):
    `lint`, `test`, `commitlint`, `secret-scan`, `dependency-audit`,
    `ai-fingerprint`, `spelling`
- [x] Require signed commits
- [x] Require linear history
- [x] Restrict who can push to matching branches → only `@rajeevyadav`
- [x] Do not allow bypassing the above settings (applies to administrators)
- [x] Block force pushes
- [x] Restrict deletions

Apply the same ruleset to any `release/*` branches.

## 2. Signed commits (§1.2, §4)

Enable SSH commit signing locally, then register the key on GitHub:

```bash
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519.pub
git config commit.gpgsign true
```

GitHub → Settings → SSH and GPG keys → **New SSH key** → Key type: **Signing
Key** (this is separate from an Authentication key). Verify the committer email
(`rajeevyadav@gmail.com`, or a `…@users.noreply.github.com` alias) is listed and
verified under Settings → Emails.

## 3. Repository security features (§1.3, §10)

GitHub → Settings → Code security and analysis, enable:

- [x] Secret scanning + push protection
- [x] Dependabot alerts (security updates only — every update still needs full
      review + CI per §10)
- [x] Private vulnerability reporting

## 4. Actions permissions (§1.3)

GitHub → Settings → Actions → General:

- Workflow permissions: **Read repository contents** (least privilege)
- [x] Require approval for all outside collaborators' workflow runs

## Applying via the API (optional)

The ruleset above can also be applied with `gh api`. Example skeleton (adjust
required checks after their first run):

```bash
gh api -X PUT repos/rajeevyadav/cleancompass/branches/main/protection \
  --input protection.json
```

Keep `protection.json` out of the repo if it contains anything sensitive; it is
configuration state, not source.
