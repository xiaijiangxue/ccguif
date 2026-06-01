## Why

外观设置已有主题、配色和 UI scale，但没有面向用户的“客户端整体透明度”控制。用户希望在支持透明窗口的平台上，让整个客户端窗口按统一 opacity 透出桌面背景，而不是只让局部 panel 变成玻璃 surface。

该能力必须在 Windows、macOS、Linux 上保持安全：支持透明窗口时即时应用；不支持或 native window effect 失败时不阻断 UI、设置保存或正常使用。

## What Changes

- 在 `设置 -> 基础设置 -> 外观` 中提供 `窗口透明` 开关。
- 开启后显示 `整体透明度` slider，按百分比控制 native 客户端窗口 alpha。
- 默认升级路径保持关闭；用户开启后默认使用可感知但不过度的透明度。
- 兼容已有 `layout.reduceTransparency` 偏好，避免旧配置失效。
- 新增 `layout.windowOpacity` 持久化整体透明度百分比。
- 主 Tauri 窗口启用 transparent window，并通过 native command 应用窗口级 opacity。
- native glass/blur effect 不作为该需求的主要实现，避免误变成局部模糊材质。
- 继续遵守 `.github/workflows/large-file-governance.yml` 的 near-threshold / hard gate。

## Out of Scope

- 不做 per-panel 透明度配置。
- 不做每个平台不同的视觉 preset。
- 不新增前端依赖；Windows native opacity 仅补齐必要的平台 FFI 依赖。
- 不保证所有 Linux compositor 都能透出桌面；不支持时必须安全降级。

## Impacted Specs

- `settings-custom-theme-presets`: 外观设置增加客户端整体透明度控制，并保持现有主题/preset runtime contract。

## Impacted Code

- `src/features/layout/hooks/useTransparencyPreference.ts`
- `src/features/app/hooks/useAppSettingsController.ts`
- `src/features/app/hooks/useLiquidGlassEffect.ts`
- `src/features/settings/components/SettingsView.tsx`
- `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx`
- `src/app-shell.tsx`
- `src/app-shell-parts/renderAppShell.tsx`
- `src/app-shell-parts/useAppShellSections.ts`
- `src/styles/base.css`
- `src/styles/settings.part2.basic-redesign.css`
- `src-tauri/src/lib.rs`
- i18n locale files and related tests.

## Success Criteria

- 用户能在外观设置中开启/关闭窗口透明。
- 用户能设置整体透明度百分比，刷新或重启后偏好保留。
- 开启后宿主窗口使用 native opacity，而不是 renderer `.app` CSS opacity 或局部 surface alpha。
- native/window effect 不可用或失败时不会白屏、不会阻止设置保存。
- 默认升级路径不突然启用透明。
- large-file governance commands 通过 hard gate。

## Implementation Review Notes

- 2026-05-29 human test confirmed the native-window implementation behaves as expected.
- Earlier renderer `.app` CSS opacity was rejected because it only changed brightness. The accepted implementation routes `整体透明度` through `set_main_window_opacity`.
- Disabled-by-default state does not call native opacity, avoiding unsupported-platform diagnostic noise on Linux. Once enabled, disabling restores native opacity to `1`.
