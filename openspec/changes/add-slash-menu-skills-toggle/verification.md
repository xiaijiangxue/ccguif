# Verification

## Status

Not executed in this turn. Project instructions for the coding phase say not to run compilation, testing, or similar verification tasks unless explicitly requested.

## Recommended Commands

```bash
npm run test -- src/features/composer/components/ChatInputBox/ChatInputBox.slash-skills.test.ts src/features/settings/components/SkillsSection.test.tsx src/features/settings/hooks/useAppSettings.test.ts
npm run typecheck
cd src-tauri && cargo test types::tests::app_settings_defaults_from_empty_json
openspec validate add-slash-menu-skills-toggle --strict --no-interactive
```
