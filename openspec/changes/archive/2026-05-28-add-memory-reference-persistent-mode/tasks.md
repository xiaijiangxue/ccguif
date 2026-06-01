## 1. OpenSpec Contract

- [x] 1.1 Create proposal/design/spec deltas for Composer Memory Reference single / always modes.
- [x] 1.2 Validate change artifacts with `openspec validate "add-memory-reference-persistent-mode" --type change --strict --no-interactive`.

## 2. Composer State And Send Behavior

- [x] 2.1 Replace Composer boolean memory reference armed state with `off | single | always` mode.
- [x] 2.2 Keep sendOptions contract as `memoryReferenceEnabled: true` whenever mode is `single` or `always`.
- [x] 2.3 After send settles, reset mode only for `single`; keep `always` active.
- [x] 2.4 Preserve context cleanup behavior so session/workspace cleanup clears the mode.

## 3. ButtonArea UI, Copy, And Styling

- [x] 3.1 Update ChatInputBox/ButtonArea prop chain to pass mode and mode setter.
- [x] 3.2 Update Memory Reference popover copy and actions for `单次开启引用` and `一直开启引用`.
- [x] 3.3 Update Chinese and English i18n keys.
- [x] 3.4 Adjust scoped composer CSS so the expanded action row remains readable.

## 4. Tests And Verification

- [x] 4.1 Update ButtonArea tests for single / always selection and manual close.
- [x] 4.2 Update Composer memory reference tests for single reset and always persistence.
- [x] 4.3 Run focused Vitest suites for touched Composer behavior.
