# Proposal: add Search Palette file-content search

## Summary

Extend the existing Search Palette so ordinary queries can surface file-content matches alongside current lightweight results. The feature follows the Palette current/global scope, preserves immediate lightweight results, loads content matches progressively, and keeps advanced text-search controls in the dedicated Workspace Search Panel.

## Why

Users often remember a code string, config value, or document phrase instead of a filename. Today that forces a context switch from Search Palette to the workspace search panel. The Palette should remain the fast global entry point while respecting strict performance boundaries.

## Scope

- Add file-content results to Search Palette for eligible ordinary text queries.
- Follow existing current/global Palette scope.
- Show lightweight results immediately while content results load asynchronously.
- Add lightweight case-sensitive and whole-word match toggles to the Palette query surface.
- Cap the initial content result batch and support lazy loading additional matches.
- Preserve existing Workspace Search Panel advanced search behavior.
- Preserve existing Palette keyboard and IME behavior.

## Non-Goals

- Persistent full-text indexing.
- Regex, include-pattern, or exclude-pattern controls in the Palette.
- Perfect global relevance ordering before showing any result.
- Raycast-style action menus or broader command-center behavior.
