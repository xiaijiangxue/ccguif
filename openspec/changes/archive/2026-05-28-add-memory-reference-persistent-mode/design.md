## Context

Composer Memory Reference 目前通过 `memoryReferenceArmed: boolean` 表达是否在下一次发送前执行 Memory Scout。`ButtonArea` 在未开启时弹出确认面板，用户确认后切到 armed；`Composer` 在发送完成后统一 `setMemoryReferenceArmed(false)`，因此行为是固定 one-shot。

用户现在需要在同一入口里区分两种生命周期：

- 单次：只影响下一次发送，发送后关闭。
- 持续：后续每次发送都启用，直到用户手动关闭。

现有下游发送链路只需要 `memoryReferenceEnabled: true` 来触发 Memory Scout，因此这次不需要修改 Project Memory 注入、Memory Scout、Retrieval Pack 或 Tauri bridge。

## Goals / Non-Goals

**Goals:**

- 把 Memory Reference UI 状态升级为 `off | single | always`。
- 在弹层中提供两个明确按钮：`单次开启引用` 和 `一直开启引用`。
- 单次模式发送后自动关闭；持续模式发送后保持。
- 图标按钮 title、aria state、弹层文案和测试都体现当前模式。

**Non-Goals:**

- 不新增全局设置。
- 不持久化持续引用模式。
- 不改变 Memory Scout 检索和注入逻辑。
- 不改变 `@@` 手动选择记忆。
- 不扩展 backend / Tauri contract。

## Decisions

### Decision 1: Composer owns the reference mode

`Composer` 维护 `memoryReferenceMode: "off" | "single" | "always"`，并派生 `memoryReferenceEnabled = memoryReferenceMode !== "off"`。

理由：
- 是否持续开启是 Composer 输入区生命周期，不是 Project Memory runtime contract。
- 发送链路继续使用现有 `memoryReferenceEnabled`，不会扩大 cross-layer blast radius。
- 切换 workspace/thread 时可沿用现有 context cleanup，一并回到 `off`。

替代方案：
- 在全局设置中保存持续引用：会重新引入静默自动注入风险，不符合现有显式入口契约。
- 下游发送链路消费 mode：当前无必要，属于过度设计。

### Decision 2: ButtonArea receives mode-specific callbacks

`ButtonArea` 接收：

- `memoryReferenceMode?: MemoryReferenceMode`
- `onSetMemoryReferenceMode?: (mode: MemoryReferenceMode) => void`

为了兼容现有中间 adapter，可短期保留 boolean 派生或在同一批改动中同步类型传递。核心原则是 ButtonArea 不直接猜发送后的关闭策略，只负责用户选择 mode。

理由：
- 弹层中两个按钮必须表达不同 intent，单个 toggle callback 不够精确。
- mode callback 比 `onEnableSingle` / `onEnableAlways` 两个 callback 更紧凑，后续测试也更清楚。

### Decision 3: Always mode still sends the same option

发送时：

```ts
const shouldReferenceMemory = memoryReferenceMode !== "off";
const sendOptions = shouldReferenceMemory
  ? { memoryReferenceEnabled: true, ...otherContext }
  : otherContextOrUndefined;
```

发送收敛后：

```ts
if (memoryReferenceMode === "single") {
  setMemoryReferenceMode("off");
}
```

理由：
- Memory Scout 只需要知道本次是否启用。
- 保持现有 tests / integration 的主要发送 contract。
- 持续模式不会影响下游，也不会变成隐藏持久设置。

## Implementation Sketch

1. 类型
   - 在 ChatInputBox 类型层定义或复用 `MemoryReferenceMode = "off" | "single" | "always"`。
   - 将 ChatInputBox / Adapter / Footer / ButtonArea 的 props 从 boolean/toggle 过渡为 mode/setter。

2. Composer 状态
   - `useState<MemoryReferenceMode>("off")`。
   - 清理上下文和切换会话时设为 `off`。
   - 构建 `sendOptions` 时用 `mode !== "off"`。
   - 发送完成后只在 `single` 模式关闭。

3. ButtonArea UI
   - 未开启点击图标打开 popover。
   - 已开启点击图标关闭并关闭 popover。
   - popover body 说明只读检索和 Memory Brief。
   - actions 中放取消、单次开启引用、一直开启引用。

4. i18n / CSS
   - 增加 mode 文案、两个按钮、状态 title。
   - 调整 actions 布局，避免三个按钮挤压中文文案。

5. Tests
   - ButtonArea：确认单次/持续按钮分别调用 setter，armed icon 关闭 mode。
   - Composer：单次发送后关闭；持续发送后保持，并且第二次发送仍传 `memoryReferenceEnabled: true`。

## Risks / Trade-offs

- [Risk] 中间 ChatInputBox adapter 仍传 boolean 导致状态丢失。Mitigation: 同步更新类型和传递链路，用 tests 锁住。
- [Risk] 持续模式被误解为全局设置。Mitigation: 不持久化，不改设置页，切换上下文清理。
- [Risk] 三按钮弹层拥挤。Mitigation: actions 允许 wrap，两个 primary action 使用清晰 label。

## Migration Plan

- 无数据迁移。
- 原 boolean `false` 映射为 `off`，原 boolean `true` 在现有测试 stub 中映射为 `single` 或显示为开启状态即可。
- 回滚方式为 revert 本 change。

## Open Questions

- 持续引用在 thread 切换后是否应保留？本变更按现有 context cleanup 语义处理：不保留，避免跨会话泄漏。
