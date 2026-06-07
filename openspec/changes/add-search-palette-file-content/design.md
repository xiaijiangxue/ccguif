# Design: Search Palette file-content search

## Product Behavior

Search Palette remains a single query surface. Lightweight providers continue to return synchronously. File-content matches are appended as a separate result kind after query settle. In current scope, the active workspace is searched. In global scope, workspaces are searched progressively with bounded concurrency and active/recent workspaces prioritized.

## Performance Contract

- Short or empty queries do not trigger content search.
- Query/scope/open-state changes invalidate stale content responses.
- Palette close prevents new content-search work and ignores late responses.
- Initial content results are capped to a page-sized batch.
- Lazy loading requests subsequent content pages only when the user approaches the end of currently available content matches.
- The backend text-search contract must support pagination or continuation semantics so the frontend does not fake pagination by repeatedly full-scanning and slicing.

## Compatibility

The existing `search_workspace_text` behavior for Workspace Search Panel remains compatible. Advanced search controls stay in that panel for this change. If pagination fields are added to the command payload, they are optional and old callers retain current behavior.
