## 1. OpenSpec Contract

- [x] 1.1 Create proposal/design/spec delta for Composer control surface stabilization.
- [x] 1.2 Validate change artifacts with `openspec validate stabilize-composer-control-surface --strict --no-interactive`.

## 2. Readiness Target And Model Selector

- [x] 2.1 Move model selection trigger into readiness target.
- [x] 2.2 Remove bottom model selector from ButtonArea.
- [x] 2.3 Add provider-grouped compact model list.
- [x] 2.4 Ensure Gemini availability creates a Gemini model group.
- [x] 2.5 Keep add-model and refresh-config footer actions provider-scoped.

## 3. Bottom Toolbar Control Surface

- [x] 3.1 Convert bottom tool dock to inline collapsible strip.
- [x] 3.2 Move trailing context/memory/reasoning/usage controls into the strip.
- [x] 3.3 Normalize icon-only hit area, spacing, and order.
- [x] 3.4 Hide duplicate context usage in tool surface while retaining main usage.
- [x] 3.5 Keep send button small rounded-square.
- [x] 3.6 Normalize selected/armed inline tools with one overlay check affordance and one selected color token.
- [x] 3.7 Move selected skill / command / agent context chips above the editor and remove `contextSurface` from ButtonArea.

## 4. Theme And Visual Geometry

- [x] 4.1 Replace fixed-color mode SVG usage with theme-inheriting codicon.
- [x] 4.2 Add home composer scoped overrides for inline tool buttons.
- [x] 4.3 Reduce composer and readiness chip corner radius.
- [x] 4.4 Reduce default composer body height by about two lines.

## 5. Verification

- [x] 5.1 Run focused toolbar/model/style tests.
- [x] 5.2 Run `pnpm typecheck`.
- [x] 5.3 Confirm local dev server responds.
- [x] 5.4 Review UI/CSS changes for Windows/macOS/Linux compatibility risks before commit.
