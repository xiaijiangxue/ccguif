# Harden Project Map Organizer Review UX

## Why

Recent Project Map organizer work made unassigned discoveries actionable, but real usage exposed four follow-up gaps:

- Organizer candidates needed stronger correctness guards so broad overview nodes are not placed under narrow implementation/detail parents.
- Candidate review needed a faster resolution path for large batches such as dozens of pending candidates.
- Organizer runs needed explainable skip and unsafe-suggestion output so "0 candidates" is not a dead end.
- The implemented behavior had to be captured back into OpenSpec after the prior Project Map changes were archived.

## What Changes

- Add project-agnostic graph-safe and hierarchy-fit validation for organizer parent moves.
- Allow valid deep parent suggestions while preventing root flattening, self-parenting, cycles, stale source parents, and abstraction-level mismatches.
- Make organizer runs record candidate, skip, and unsafe suggestion details for task history.
- Make Unassigned Discoveries explain how AI organize works and expose the organize entry point from both toolbar and detail panel.
- Make the candidate badge navigate to pending review candidates, including AI organizer parent-move candidates.
- Add a top-bar "Accept all" action that atomically confirms all current candidates that pass existing validation and skips failures.

## Impact

- Affected specs:
  - `project-map-incremental-generation`
  - `project-xray-panel`
- Affected implementation:
  - Project Map panel toolbar/detail UX
  - Project Map dataset hook candidate confirmation path
  - Project Map organizer worker, run metadata, and task drawer
  - Candidate confirmation utilities and focused tests

