## Context

外观设置集中在 `BasicAppearanceSection`，主题偏好经 `AppSettings` 持久化到 Tauri settings；历史透明度开关则使用 client storage key：`layout.reduceTransparency`。用户这次明确需求是“客户端整体透明度”，不是局部 surface 透明模糊。

Tauri 当前 `@tauri-apps/api/window` 类型没有暴露 `setOpacity`。因此本次实现必须补一个受控 Rust command：前端只传 normalized opacity，后端按平台调用 native window alpha；不再用 renderer `.app { opacity }` 模拟。

## Goals / Non-Goals

**Goals:**

- 在外观设置暴露 `窗口透明` 开关与 `整体透明度` 百分比 slider。
- 用单一 hook 管理持久化、旧值兼容和 sanitize。
- 透明开关关闭时保持现有视觉稳定。
- 透明开关开启时只影响客户端整体 opacity，不做局部 surface alpha 改写。
- Windows、macOS、Linux 上 native/window effect 失败必须安全降级。
- 遵守 large-file governance。

**Non-Goals:**

- 不做 per-panel 透明。
- 不做 renderer CSS opacity 模拟。
- 不新增前端依赖。
- 不承诺所有 Linux compositor 都能透出桌面背景。

## Decisions

### Decision 1: 复用 client storage，而不是扩展 `AppSettings`

整体透明度属于纯 UI display preference，现有 `reduceTransparency` 已在 client storage；继续放在 `layout` domain 可以避免 Rust settings schema 扩张和跨层重启语义。新增 `layout.windowOpacity` 保存百分比。

### Decision 2: 使用正向语义字段，兼容旧 `reduceTransparency`

历史 key 是反向语义：`reduceTransparency=true` 表示关闭透明。UI 新文案使用正向语义：`windowTransparencyEnabled`。

hook 暴露：

- `reduceTransparency`
- `setReduceTransparency`
- `windowTransparencyEnabled`
- `setWindowTransparencyEnabled`
- `windowOpacity`
- `setWindowOpacity`

这样旧调用方和旧 class contract 仍可继续工作。

### Decision 3: 用 native window opacity 表示整体透明度

局部透明 surface 与 `.app` CSS opacity 都会造成用户误解：前者不是整体透明，后者只是把 DOM 像素压暗。真正的客户端整体透明度必须落在 native 窗口层。

本次新增 `set_main_window_opacity(opacity)` Tauri command。hook 在透明开启时传 `windowOpacity / 100`，关闭时传 `1`。失败或 unsupported 只记录 renderer diagnostic，不阻断设置保存。

### Decision 4: Tauri 主窗口启用 transparent window

宿主窗口仍使用 `.transparent(true)` 作为 native alpha 的前置条件。平台不支持透明窗口或 native opacity 时，后端返回 `applied=false` diagnostic，UI 保持正常。

### Decision 5: native blur/glass 不作为主实现

`useLiquidGlassEffect` 不再启用 blur radius。为避免和整体 opacity 语义混淆，native glass/blur effects 保持关闭；失败只记录 debug，不影响窗口渲染。

### Decision 6: 透明度范围保守

`windowOpacity` 范围为 `55-100%`，默认 `88%`。开关默认关闭，升级后仍是 `100%` 视觉；用户开启后默认透明度足够可见，但避免低到影响可读性。

## Risks / Trade-offs

- [Risk] Linux 或部分 compositor 不支持 native window opacity → 安全降级为普通窗口并记录 diagnostic。
- [Risk] 整体 opacity 会让文字也一起变淡 → 这是“客户端整体透明度”的语义，符合本次需求；若后续需要只淡背景，应另开 per-surface 设计。
- [Risk] 透明度过低影响可读性 → 下限限制为 55%。
- [Risk] transparent window 可能暴露平台差异 → 需要 macOS/Windows/Linux 实机验收。

## Migration Plan

1. 读取旧 `layout.reduceTransparency`：
   - 缺失时默认 `true`，保持窗口透明关闭。
   - 存在时按旧语义继续生效。
2. 新增 `layout.windowOpacity`：
   - 缺失或非法时回退 `88`。
   - 越界时 clamp 到 `55-100`。
3. 旧的 `layout.translucentBlurIntensity` 不再读取；无需迁移脚本。

## Open Questions

- 如果未来需要真正 native window opacity API，应通过 Rust command 增加显式 contract，而不是猜测前端 API。
