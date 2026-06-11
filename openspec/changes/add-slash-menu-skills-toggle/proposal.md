# Proposal: add slash menu Skills toggle

## Summary

Add a user setting that allows the `/` command completion menu to include available Skills from the existing `$` skill selector. The setting is off by default so the current command-only slash menu remains unchanged unless explicitly enabled.

## Why

Users who rely on Skills often discover commands through `/` first. Letting Skills appear in the same menu, behind an explicit preference, reduces trigger memorization without removing the dedicated `$` flow.

## Scope

- Add a persisted setting for showing Skills in the slash command menu.
- Expose the setting in the Skills settings surface.
- When enabled, merge Skills into `/` completion results using the existing skill provider.
- Selecting a Skill from `/` SHALL invoke the same skill selection behavior as `$`.
- Preserve existing slash command filtering, insertion, and loading behavior when disabled.

## Non-Goals

- Removing or changing the `$` skill selector.
- Changing backend skill discovery semantics.
- Adding a new skill execution path.
