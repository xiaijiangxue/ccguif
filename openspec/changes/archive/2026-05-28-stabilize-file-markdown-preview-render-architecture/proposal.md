## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: Original 26/26 checked; 2026-05-28 follow-up tasks added, so this change is no longer ready to archive.
- **Code/document evidence**: `compileFileMarkdownDocument`、Mermaid/KaTeX caches、annotation/block model、large render path 与 file Markdown tests 已存在。
- **Next action**: 归档前补 file Markdown architecture verification，包括 no-reparse/no-flicker/large document evidence。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## 2026-05-28 Follow-up: Markdown Preview Correctness & Interaction Stability

- **Current branch**: `feature/v0.5.4`; this refresh is documentation-only and does not change implementation code.
- **New evidence**: 多列表格横向滚动、AI 标注 draft 输入、table/list/math/Mermaid/flowchart rendered block 与公式预览仍可能被 preview subtree rerender 扰动。
- **Gap**: 现有 stable snapshot / compile cache 主要保护“内容模型”不重复解析，但还没有把 Markdown block rendering correctness、局部刷新边界和 preview 内部 DOM interaction state 作为一等 contract 管理。
- **Decision**: 本 change 不新开平行提案，继续扩展为 Markdown preview correctness + partial refresh + interaction state island 治理，补齐表格/列表/公式/Mermaid/flowchart 渲染正确性、表格横向滚动、annotation draft 输入、heavy block 视图状态与父级刷新隔离。
- **Next action**: 先补 proposal/design/tasks/spec contract，再进入实现与 focused regression。

## Why

Markdown 文件预览在加入数学公式、Mermaid 和 AI 标注后暴露出系统性卡顿与闪烁：同一份文档会因外部文件同步、annotation state、heavy block render 等非内容语义变化被反复全量解析和重建。现在需要从“局部补丁”升级为文件预览渲染架构治理，拆开文档快照、Markdown 编译、标注 overlay 与重型 block 生命周期。

用户视频证据显示，短时间内同一个 Markdown preview 在表格视图与 Mermaid rendered view 之间反复切换，说明问题不是单点慢，而是 preview subtree 被周期性扰动后状态回退。

## 目标与边界

- 根治文件系统 Markdown preview 的大文件卡顿、周期性刷新扰动和 Mermaid/KaTeX 闪烁。
- 保持 file-preview dedicated renderer 边界，不迁移到 message Markdown renderer。
- 将 AI 标注从 Markdown 全量 render hot path 中解耦，避免 annotation typing 或 marker 更新触发整篇文档重解析。
- 保留 live edit preview 的显式 opt-in 语义，但默认阅读模式必须稳定。
- 为大 Markdown 文件建立 deterministic degradation / progressive render / virtualization 策略。

## 非目标

- 不重写 chat message Markdown renderer。
- 不改变 Tauri 文件读取 command 的签名。
- 不改变 detached file explorer 已有外部变更感知契约，除非后续单独提案。
- 不新增 Markdown runtime execution 或 MDX 执行能力。
- 不为了局部体感优化引入机器性能依赖型阈值。

## What Changes

- 引入 Markdown file preview stable snapshot contract：默认阅读模式下外部文件变化不得直接重建 preview DOM。
- 引入 file Markdown compile cache / render model：同一 `documentKey + contentHash + rendererProfile` 不重复执行 normalization、frontmatter、line map 和 block key 派生。
- 将 AI annotation placement 改为预计算索引或等价 overlay contract，annotation state 变化不得触发整篇 Markdown 重新 parse。
- 增加 Markdown block rendering correctness contract：table、list/nested list、math/KaTeX、Mermaid/flowchart、code block 必须按类型回归验证，不能因性能优化降级出错。
- 为 Mermaid、KaTeX、large table、large code block 建立 heavy block isolation：lazy render、result cache、旧结果保持可见、后台刷新。
- 为大 Markdown 文件建立 block-level progressive rendering / virtualization gate，避免一次性向 React tree 挂载全部高成本内容。
- 引入 partial refresh / non-amplification contract：annotation、hover、scroll、theme 或同内容 refresh 只能更新受影响 block / overlay，不能重建无关 block subtree。
- 引入 Markdown preview interaction state island contract：表格横向滚动位置、annotation draft 输入/selection/composition、Mermaid rendered/source tab 与 heavy block visibility 等本地交互状态，必须在父级 rerender、annotation overlay 更新、同内容刷新中保持稳定。
- 增加 focused regression 与 perf evidence，覆盖 no-flicker、no-reparse、annotation overlay、大文件降级和 live preview opt-in。

## 技术方案取舍

### 方案 A：继续局部 memo / debounce

- 优点：改动小，短期可能降低部分闪烁。
- 缺点：无法阻断 annotation、external sync、Mermaid、KaTeX 互相拖拽；大文件仍会全量 parse/render。
- 结论：只适合作为热修，不满足根治目标。

### 方案 B：引入 stable snapshot + compile cache + overlay + heavy block isolation

- 优点：直接切断卡顿根因，把内容生命周期、标注生命周期、重型 block 生命周期拆开；可用 tests/perf gate 验证。
- 缺点：需要调整 `FileMarkdownPreview` / `FileViewPanel` 的数据流与测试基线。
- 结论：本 change 采用该方案。

### 方案 C：替换 Markdown renderer 或迁移到 message renderer

- 优点：可能复用现有 message streaming mitigation。
- 缺点：破坏 file-preview source-fidelity 边界，容易引入 chat-oriented normalization 和 controls；不解决 annotation overlay 与 file snapshot 问题。
- 结论：拒绝。renderer 边界继续保持 file-preview dedicated。

## Capabilities

### New Capabilities

- `file-markdown-preview-render-architecture`: 定义 Markdown 文件预览的 stable snapshot、compile cache、annotation overlay、heavy block isolation 与大文件 progressive/virtualized render contract。

### Modified Capabilities

- `file-view-rendering-runtime-stability`: 补充文件预览默认阅读快照、外部变更不扰动 DOM、rich preview 降级与高成本 block 响应性要求。
- `file-view-markdown-github-preview`: 补充 dedicated Markdown renderer 在 AI 标注、Mermaid/KaTeX 与大文档下的 no-flicker / no-reparse / source-fidelity 稳定性要求。

## Impact

- Frontend:
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/features/files/components/FileViewBody.tsx`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/hooks/useFileExternalSync.ts`
  - `src/features/markdown/markdownMath.ts`
  - `src/styles/file-view-panel.css`
- Tests:
  - focused file-view Markdown preview tests
  - annotation placement regression tests
  - Mermaid no-flicker regression tests
  - large Markdown render/perf smoke tests
- APIs/dependencies:
  - No Tauri command signature change.
  - Prefer existing `@tanstack/react-virtual` for block virtualization; no custom virtual scroller.
- Systems:
  - 主窗口 Markdown 阅读体验默认稳定。
  - live edit preview 继续显式 opt-in。
  - detached explorer contract 保持不变，后续若要统一阅读锁定另开 change。

## 验收标准

- annotation draft 输入时不得重新 parse 整篇 Markdown。
- table、list/nested list、math formula、Mermaid/flowchart 的 rendered output 必须保持 GitHub-style / existing file-preview 语义正确。
- annotation、hover、scroll 或同内容 refresh 不得重建无关 Markdown block subtree。
- 多列表格横向滚动后，annotation state 更新、父级 rerender 或同内容刷新不得将 `scrollLeft` 重置为 0。
- annotation draft 输入、selection 与 IME composition 不得因 Markdown block rerender 丢失焦点、光标或已输入文本。
- 同内容 rerender 不得重新执行 Mermaid render。
- Mermaid rendered tab 不得闪回 Source 或 loading；theme refresh 时旧 SVG 保持可见。
- external polling / watcher 检测到同内容或 pending disk change 时不得扰动 preview DOM。
- 大 Markdown 文件必须进入 deterministic degradation / progressive / virtualized render 路径，不能无限期阻塞主线程。
- `openspec validate stabilize-file-markdown-preview-render-architecture --strict --no-interactive` 通过。
