# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Rajeev Yadav

## Context

GOVERNANCE.md §11 requires an Architecture Decision Record for any non-obvious
design choice, technology selection, or deviation from standards. We need a
lightweight, reviewable format that lives alongside the code and is version
controlled like any other artifact.

## Decision

We record architecture decisions as Markdown files in `docs/adr/`, numbered
sequentially (`NNNN-kebab-title.md`), following the template in
`0000-template.md`. Each ADR is reviewed through the standard pull-request
process. ADRs are immutable once accepted; a reversal is a new ADR that marks
the old one as superseded.

## Consequences

- Design rationale is traceable and survives contributor turnover.
- Reviewers can check the GOVERNANCE.md §5 checklist item "every non-obvious
  decision has an ADR" against a concrete artifact.
- A small authoring overhead is added to non-trivial design changes, which is
  the intended discipline.

## Alternatives considered

- **Decisions captured only in PR descriptions:** rejected — PR history is
  harder to browse as a coherent decision log and is not co-located with the
  design docs.
- **A wiki:** rejected — not version controlled with the code and not subject
  to the same review gates.
