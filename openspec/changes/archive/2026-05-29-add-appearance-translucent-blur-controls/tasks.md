## Tasks

- [x] 1. Extend transparency preference hook with positive window-transparency semantics, opacity persistence, and sanitize/clamp behavior.
- [x] 2. Wire AppShell to the new whole-client opacity preference while preserving old reduced-transparency class behavior.
- [x] 3. Add appearance settings controls, i18n copy, and scoped styles for window transparency / overall opacity.
- [x] 4. Enable transparent main Tauri window and add native window opacity command for supported platforms.
- [x] 5. Keep native glass/blur effects disabled for this whole-window opacity mode and preserve diagnostic fallback.
- [x] 6. Update tests for settings UI, persistence behavior, service mapping, and cross-platform safe fallback semantics.
- [x] 7. Run validation: OpenSpec strict validate, focused Vitest, typecheck, and large-file governance commands from `.github/workflows/large-file-governance.yml`.
