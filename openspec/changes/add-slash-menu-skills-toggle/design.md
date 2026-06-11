# Design: slash menu Skills toggle

## Product Behavior

The setting is stored with app settings and defaults to `false`. When disabled, `/` completion returns the existing command list only. When enabled, `/` completion queries both the command provider and the existing skill provider, then renders Skills as selectable menu entries.

Selecting a Skill from `/` does not insert slash text into the composer. It clears the active completion token and calls the existing `onSelectSkill(skillName)` callback, matching the `$` selector.

## Compatibility

The `$` selector remains available and uses the same provider. Existing command items remain command items, preserving `/clear`, custom commands, and engine-specific slash command behavior.

## Error Handling

If skill loading fails or is aborted, the slash menu remains usable with command results. Skill failures must not replace command results with an error item.

## UI Placement

The switch lives in the Skills settings section because the behavior controls Skill discoverability in the composer rather than command execution itself.
