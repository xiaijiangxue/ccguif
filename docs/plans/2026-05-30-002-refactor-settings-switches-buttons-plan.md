---
title: "refactor: unify settings switches and buttons with Liquid Precision styling"
type: refactor
status: completed
date: 2026-05-30
---

# refactor: Unify settings switches and buttons with Liquid Precision styling

## Summary

Modernize the shared Switch and Button UI primitives with Liquid Precision styling (inner-glow borders, multi-layer soft shadows, refined transitions, warm-tinted dark backgrounds), then consolidate the three inconsistent toggle-row patterns and migrate legacy raw `<button>` elements in settings sections to the shared `<Button>` component. This delivers a unified, refined visual language for all switches and buttons across settings pages.

---

## Problem Frame

Settings pages currently exhibit four sources of visual inconsistency:

1. **Switch component** (`src/components/ui/switch.tsx`) uses basic Tailwind classes without the Liquid Precision polish (no inner-glow border, no multi-layer shadow, generic thumb styling).
2. **Button component** (`src/components/ui/button.tsx`) uses basic shadcn variants without the premium feel (no multi-layer shadows, generic hover states).
3. **Two competing button systems** coexist: the shared shadcn `<Button>` (Tailwind/cva) and raw `<button>` elements with legacy CSS classes (`.primary`, `.secondary`, `.ghost`) from `buttons.css`.
4. **Three toggle-row layout patterns**: plain `settings-toggle-row` (settings.part1.css), card-based `settings-toggle-row` (settings.part2.css), and the basic-redesign override (settings.part2.basic-redesign.css) — each with different border-radius, backgrounds, and grid behavior.

---

## Requirements

### Visual consistency
- R1. Switch component reflects Liquid Precision styling: inner-glow border, refined thumb with subtle shadow, smooth checked-state transition.
- R2. Button variants (default/primary, outline, secondary, ghost, destructive) carry Liquid Precision multi-layer shadows, inner-glow borders, and premium hover/active states.
- R3. All settings toggle rows use a single consistent layout pattern with unified border-radius, background, and spacing.

### Migration
- R4. Legacy raw `<button className="primary|secondary|ghost">` in settings sections are replaced with `<Button variant="...">`.
- R5. `buttons.css` global button base is updated with Liquid Precision refinements for non-migrated surfaces.

### Preservation
- R6. No functional or behavioral changes — all toggle states, click handlers, disabled states, and keyboard interactions remain identical.
- R7. Existing tests pass without assertion value changes where possible; CSS-only changes documented where test updates are needed.

---

## Key Technical Decisions

- **Update shared primitives first, then migrate settings-specific code.** The Switch and Button components are used site-wide; refining them at the primitive level ensures settings pages inherit the improvements automatically while also benefiting all other surfaces.
- **Use the card-based toggle-row pattern (settings.part2.css) as the canonical pattern.** It has better visual hierarchy (min-height 64px, color-mix backgrounds) and aligns with the Liquid Precision direction. The basic-redesign override refines it further with grid layout; non-basic sections should adopt the same structure.
- **Map legacy button classes to shadcn variants.** `.primary` -> `variant="default"`, `.secondary` -> `variant="secondary"`, `.ghost` -> `variant="outline"`. This preserves semantic intent while consolidating on one system.
- **Keep `buttons.css` as a refined fallback** rather than deleting it — other non-settings surfaces still use raw `<button>` elements, and the global base styles benefit from the Liquid Precision update.

---

## Implementation Units

### U1. Modernize Switch component with Liquid Precision styling

**Goal:** Update the shared Switch primitive to reflect the Liquid Precision design direction — inner-glow borders, refined thumb styling, smooth transitions, and premium checked-state colors.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- `src/components/ui/switch.tsx` — primary implementation
- `src/features/settings/components/SettingsView.test.tsx` — verify switch-related tests

**Approach:**
- Add inner-glow border via `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)` on the track.
- Add subtle outer shadow for depth: `0 1px 3px rgba(0,0,0,0.2)`.
- Refine thumb: white with subtle shadow `0 1px 4px rgba(0,0,0,0.25)`, not just `bg-background shadow-sm/5`.
- Checked state: use primary color at reduced saturation with inner-glow border, matching the basic-redesign pattern.
- Transition: `transition-all duration-200` for smooth state changes. Add `motion-reduce:transition-none` to respect `prefers-reduced-motion`.
- Disabled state: `opacity-0.5` with `cursor: not-allowed`.

**Patterns to follow:**
- The basic-redesign's switch override in `settings.part2.basic-redesign.css` (lines 442-458) as reference for the refined checked-state styling.
- Existing `cn()` + Tailwind composition pattern in the component.

**Test scenarios:**
- Happy path: switch toggles between checked/unchecked with smooth visual transition.
- Edge case: disabled switch renders with reduced opacity and no hover effect.
- Edge case: switch renders correctly in both dark and light themes.
- Integration: all settings sections using `<Switch>` render with updated styling without layout shift.

**Verification:**
- Switch visually matches Liquid Precision direction (inner-glow, refined thumb, smooth transition). `npm run test` passes.

---

### U2. Modernize Button component with Liquid Precision styling

**Goal:** Update the shared Button primitive variants with Liquid Precision styling — multi-layer shadows, inner-glow borders, refined hover/active states, and consistent border-radius.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- `src/components/ui/button.tsx` — primary implementation

**Approach:**
- **default/primary variant:** Multi-layer shadow `0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)`, inner-glow border, hover: subtle brightness shift, active: `scale(0.98)`.
- **outline variant:** Inner-glow border `inset 0 0 0 1px rgba(255,255,255,0.08)` replacing solid border, subtle background on hover, no heavy shadow.
- **secondary variant:** Refined surface color with inner-glow border, lighter shadow than primary.
- **ghost variant:** No border/shadow, refined hover background with accent tint.
- **destructive variant:** Multi-layer shadow similar to primary but with destructive color.
- All variants: `transition-all duration-200 cubic-bezier(0.4, 0, 0.2, 1)`, `rounded-lg` (8px). Add `motion-reduce:transition-none` to respect `prefers-reduced-motion`.
- Focus ring: `2px solid accent + 2px offset`.

**Patterns to follow:**
- Liquid Precision design direction from the sitewide plan (docs/plans/2026-05-30-001-refactor-sitewide-modern-minimal-ui-plan.md).
- Existing `cva` variant pattern in the component.

**Test scenarios:**
- Happy path: each variant (default, outline, secondary, ghost, destructive) renders with distinct visual treatment.
- Edge case: disabled button shows `opacity-0.5` with `cursor: not-allowed`.
- Edge case: button with icon (`has-[>svg]`) adjusts padding correctly.
- Edge case: all size variants (default, xs, sm, lg, icon) maintain correct dimensions.
- Integration: buttons in settings sections render with updated styling without layout shift.

**Verification:**
- Button variants visually match Liquid Precision direction. `npm run test` passes.

---

### U3. Consolidate settings toggle-row patterns

**Goal:** Unify the three inconsistent toggle-row CSS patterns into one canonical pattern, ensuring all settings sections use the same toggle-row layout.

**Requirements:** R3, R6, R7

**Dependencies:** U1

**Files:**
- `src/styles/settings.part1.css` — update base `.settings-toggle-row` definition
- `src/styles/settings.part2.css` — update/align toggle-row definition
- `src/styles/settings.part2.basic-redesign.css` — reduce overrides now that base is unified
- `src/features/settings/components/settings-view/sections/ComposerSection.tsx` — uses `settings-toggle-row` (9 instances)
- `src/features/settings/components/settings-view/sections/DictationSection.tsx` — uses `settings-toggle-row`
- `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx` — uses `settings-toggle-row`
- `src/features/settings/components/settings-view/sections/DetachedExternalChangeToggles.tsx` — likely uses `settings-toggle-row`
- `src/features/settings/components/settings-view/components/ExperimentalToggleRow.tsx` — reusable toggle row component

**Approach:**
- Consolidate the base `.settings-toggle-row` in `settings.part1.css` to match the card-based pattern: `min-height: 64px`, `border-radius: 14px`, `color-mix` background and border.
- Update `settings.part2.css` to remove the duplicate definition (it currently redefines `.settings-toggle-row` at line 2039).
- Simplify `settings.part2.basic-redesign.css` overrides — the grid layout override (`grid-template-columns: minmax(0,1fr) auto`) stays, but the redundant border-radius/background overrides are no longer needed.
- Ensure `ExperimentalToggleRow` component uses the unified pattern.

**Patterns to follow:**
- The card-based pattern from `settings.part2.css` (lines 2039-2045) as the canonical base.
- The basic-redesign grid layout override for consistent switch positioning.

**Test scenarios:**
- Happy path: all toggle rows across Composer, Dictation, BasicAppearance, DetachedExternalChange, and Experimental sections render with consistent card styling.
- Edge case: highlighted toggle row (`.is-highlighted`) retains its pulse animation and accent border.
- Integration: toggle rows inside `.settings-section-basic` still apply grid layout override correctly.

**Verification:**
- Visual inspection confirms all toggle rows match. `npm run test` passes.

---

### U4. Migrate legacy raw buttons in settings to shared Button component

**Goal:** Replace raw `<button className="primary|secondary|ghost|settings-button-compact">` in settings sections with `<Button variant="...">`, eliminating the competing button system.

**Requirements:** R4, R6

**Dependencies:** U2

**Files:**
- `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx` — 12+ raw buttons
- `src/features/settings/components/settings-view/sections/DictationSection.tsx` — raw buttons
- `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx` — raw buttons
- `src/features/settings/components/settings-view/sections/WebServiceSettings.tsx` — 16+ raw buttons
- `src/features/settings/components/settings-view/sections/ComposerSection.tsx` — raw buttons
- `src/features/settings/components/AgentSettingsSection.tsx` — raw buttons mixed with `<Button>`
- `src/features/settings/components/SkillsSection.tsx` — raw buttons mixed with `<Button>`
- `src/features/settings/components/ProjectSessionManagementSection.tsx` — raw buttons

**Approach:**
- Class-to-variant mapping: `.primary` -> `variant="default"`, `.secondary` -> `variant="secondary"`, `.ghost` -> `variant="outline"`.
- `.settings-button-compact` -> `size="sm"` or `size="xs"` (existing shadcn sizes).
- `.icon-button` -> `size="icon"` or `size="icon-sm"`.
- Add `import { Button } from "@/components/ui/button"` to files that don't already import it.
- Remove leftover `.primary`, `.secondary`, `.ghost` className strings.

**Patterns to follow:**
- Files already using `<Button>` correctly (e.g., `BasicBehaviorSection.tsx`, `RuntimePoolSection.tsx`, `McpSection.tsx`).

**Test scenarios:**
- Happy path: all buttons in migrated settings sections render with shared Button component styling.
- Edge case: icon-only buttons maintain correct padding and icon sizing.
- Edge case: small/compact buttons match previous `settings-button-compact` dimensions.
- Integration: button click handlers, disabled states, and form submissions work identically to pre-migration.

**Verification:**
- All migrated sections render buttons visually matching the shared system. `npm run test && npm run typecheck` pass.

---

### U5. Refine buttons.css global base with Liquid Precision

**Goal:** Update the global `buttons.css` base styles with Liquid Precision refinements as a fallback for non-settings surfaces that still use raw `<button>` elements.

**Requirements:** R5

**Dependencies:** U2

**Files:**
- `src/styles/buttons.css`

**Approach:**
- Update bare `button` base: consistent `rounded-lg` (8px), refined transition `transition-all duration-200 cubic-bezier(0.4, 0, 0.2, 1)`. Add `prefers-reduced-motion` media query to disable transitions.
- Update `.primary` class: add multi-layer shadow, inner-glow border.
- Update `.secondary` class: add inner-glow border, subtle shadow.
- Update `.ghost` class: add inner-glow border, remove heavy border.
- Update `:disabled`: use `opacity-0.5` + `cursor: not-allowed`.
- Keep the file intact since other non-settings surfaces depend on these classes.

**Test scenarios:**
- Test expectation: none — CSS-only global fallback refinement, no behavioral change.

**Verification:**
- Non-settings surfaces using raw buttons render with refined base styling. `npm run test` passes.

---

## Scope Boundaries

- This plan changes switch and button visual styling in settings pages; it does not change settings navigation, section routing, data flows, or form submission behavior.
- This plan does not restructure `SettingsView.tsx` (2394-line near-threshold file) beyond the button/switch migration within its child sections.
- This plan does not touch input fields, selects, dropdowns, or other form controls beyond switches and buttons.
- Vendor settings panels (`VendorSettingsPanel.tsx`, provider dialogs) are included only insofar as they use the shared `<Button>` or `<Switch>` components — no vendor-specific styling work.

### Deferred to Follow-Up Work

- Full vendor panel visual refresh (depends on U1 of the sitewide plan).
- Input/select/dropdown form control modernization.
- Settings sidebar navigation button migration from raw `<button>` to shared `<Button>`.
- Settings section tab button migration from raw `<button>` to shared `<Button>`.

---

## Sources & References

- Existing plan: `docs/plans/2026-05-30-001-refactor-sitewide-modern-minimal-ui-plan.md` (Liquid Precision design direction, U3 settings surface scope)
- Switch component: `src/components/ui/switch.tsx` (current implementation)
- Button component: `src/components/ui/button.tsx` (current implementation)
- Legacy button CSS: `src/styles/buttons.css` (competing system)
- Toggle row CSS: `src/styles/settings.part1.css` (line 1149), `src/styles/settings.part2.css` (line 2039), `src/styles/settings.part2.basic-redesign.css` (line 377)
- Settings entry: `src/features/settings/components/SettingsView.tsx`
