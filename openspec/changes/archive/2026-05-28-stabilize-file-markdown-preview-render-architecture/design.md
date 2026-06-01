## Context

当前文件 Markdown preview 已经承担 GitHub-style rendering、math normalization、KaTeX、Mermaid、frontmatter、code highlighting 和 AI annotation。问题在于这些能力全部挂在 `FileMarkdownPreview` 的同一个 ReactMarkdown render path 上：`content` 或 annotation state 一变，就可能触发 Markdown normalization、HAST render、annotation placement、Mermaid render 和布局重算。

现有 `fix-markdown-preview-auto-refresh` 已经通过主窗口 live edit preview gating 减少默认 polling 扰动，但这只是切掉一个入口。只要 live preview、detached watcher、annotation typing、theme mutation 或同内容 remount 继续触发重型 subtree，就仍会出现卡顿与闪烁。

## Goals

- 将文件 Markdown preview 改为 stable snapshot 驱动。
- 将 Markdown 编译/归一化与 annotation UI 状态解耦。
- 将 Mermaid/KaTeX/table/code 等 heavy blocks 从普通 block render 中隔离。
- 对大文档使用 deterministic budget 和 viewport projection，而不是依赖机器速度。
- 保持 file-preview dedicated renderer 与 source-fidelity。

## Non-Goals

- 不复用 message Markdown renderer。
- 不引入 MDX runtime。
- 不改变 Rust/Tauri 文件读取 API。
- 不改变 detached explorer 外部同步 contract。
- 不把所有 Markdown 都降级成纯文本。

## Architecture

```text
file read / external sync
  -> document snapshot controller
  -> stablePreviewSnapshot
  -> compileFileMarkdownDocument(documentKey, contentHash, rendererProfile)
  -> block render model
  -> annotation placement index
  -> interaction state islands
  -> visible block renderer
  -> heavy block renderer cache/lazy budget
```

### Layer 1: Stable Preview Snapshot

主窗口阅读模式的 preview 输入不再直接等于每次外部同步后的 mutable `content`。文件读取产生 `loadedSnapshot`；外部变化产生 `pendingDiskSnapshot`；preview 默认消费 `stablePreviewSnapshot`。

- 默认阅读模式：外部变化只显示 refresh affordance，不直接替换 preview DOM。
- live edit preview：允许推进 snapshot，但必须 debounce、hash equality guard，并保留 heavy block state。
- dirty buffer：继续走冲突保护，不自动覆盖用户编辑内容。

### Layer 2: Markdown Compile Cache

新增 pure helper 或 feature-local module：

```ts
compileFileMarkdownDocument({
  documentKey,
  contentHash,
  rawMarkdown,
  rendererProfile,
})
```

输出 frontmatter、normalized body、line map、block descriptors、heavy block descriptors 与 diagnostics。cache key 必须至少包含 `documentKey + contentHash + rendererProfile`。annotation list、annotation draft、i18n labels、hover state 不得成为 compile cache key。

### Layer 3: Annotation Overlay / Placement Index

AI annotation 不再通过每个 rendered block 对 `annotations.filter(...)` 加 nested children traversal 决定落点。编译阶段或 annotation state 派生阶段建立 placement index：

```text
source line range -> most-specific block id -> annotations/draft bucket
```

block render 只查自己的 bucket，复杂度应接近 O(block annotations)，不得对每个 block 扫全量 annotations 或 React children。

### Layer 4: Heavy Block Isolation

Mermaid、KaTeX、large table、large code block 独立 lifecycle：

- Mermaid cache key: `documentKey + blockKey + valueHash + theme`
- Mermaid rerender 时保留 previous success SVG，后台刷新成功后替换。
- KaTeX assets idle prewarm；formula render cache by formula hash。
- 大 table / 超长 code block 支持 lazy mount、collapse 或 viewport window。
- viewport 外 heavy block 不启动昂贵 render。

### Layer 5: Render Correctness Contract

性能优化不得改变 Markdown 文件预览的类型语义。编译缓存、progressive render、heavy block lazy mount 和 partial refresh 都必须以 rendered output correctness 为前提。

必须按 block type 建立 focused regression：

- table：header/body、alignment、wide table horizontal overflow、inline Markdown in cells。
- list：ordered/unordered、nested list、task list、列表内 paragraph/code/math。
- math：inline math、block math、invalid formula fallback、source line mapping。
- Mermaid / flowchart：source tab、rendered tab、render failure fallback、theme refresh previous-success preservation。
- code block：language class、plain fallback、large code lazy mount、annotation anchor stability。

局部刷新原则：

- content hash changed：允许重新 compile / rerender affected document model。
- block content changed：允许重建该 block 及其 dependent heavy render state。
- annotation / hover / scroll / draft / same-content refresh changed：只能更新 affected overlay 或 interaction island，不能重建无关 block subtree。

### Layer 6: Large Markdown Progressive / Virtualized Rendering

按 deterministic threshold 选择 render path：

| Condition | Strategy |
|---|---|
| small Markdown | normal rich render |
| medium Markdown | progressive block render |
| large Markdown or many blocks | block-level virtualization |
| truncated file | low-cost readable fallback |

推荐初始阈值由文件大小、line count、block count、heavy block count 和 `truncated` 决定，避免使用设备速度作为 primary trigger。

### Layer 7: Interaction State Islands

stable snapshot 与 compile cache 只能保证“同内容不重编译”。文件预览还必须保护用户正在操作的 DOM-local state，避免父组件刷新、annotation overlay 更新或同内容 refresh 让交互状态回到初始值。

受保护的 state 至少包括：

- table wrapper horizontal scroll：`blockKey -> scrollLeft`
- annotation draft input：`draftKey -> value/selection/composition/focus intent`
- Mermaid / flowchart view mode：`blockKey -> rendered/source tab + previous successful render`
- heavy block visibility：`blockKey -> lazy visibility/expanded state`

实现上优先使用 preview-local registry/ref，而不是把每一次滚动或输入都提升成高频 React state。React state 只用于必须驱动可见 UI 的低频状态；滚动位置、selection、composition 这类高频状态应在 affected node unmount/remount 边界做 capture/restore。

关键 contract：

- block identity MUST derive from compiled block key and content hash, not array index alone.
- unrelated annotation changes MUST NOT recreate unrelated heavy block renderer props.
- table wrapper MUST restore `scrollLeft` after same-content rerender or block-local remount.
- annotation draft textarea MUST preserve focus, text, selection, and IME composition across preview-local refresh.
- interaction state capture MUST stay frontend-local and MUST NOT introduce per-scroll/per-keypress IPC.

## Data Flow

1. `FileViewPanel` 读取文件并维护 content/snapshot refs。
2. snapshot controller 决定 preview 当前消费哪个 stable snapshot。
3. `FileMarkdownPreview` 接收 stable snapshot，不直接订阅 external sync state。
4. compile helper 根据 content hash 产出 block model。
5. annotation index 根据 block ranges 和 annotations 派生。
6. interaction state registry 根据 stable block identity 绑定 scroll/input/view-mode 状态。
7. visible renderer 根据 budget 渲染 blocks。
8. heavy blocks 通过 cache/lazy renderer 单独运行。

## Error Handling

- Markdown compile failure MUST fail closed to readable low-cost preview。
- Mermaid render failure MUST confined to that block，不能重建整篇 preview。
- KaTeX render failure MUST show readable source fallback for that formula/block。
- External refresh conflict MUST stay in file sync UI，不直接破坏 stable preview snapshot。

## Validation Matrix

| Area | Evidence |
|---|---|
| OpenSpec | `openspec validate stabilize-file-markdown-preview-render-architecture --strict --no-interactive` |
| Type safety | `npm run typecheck` |
| File preview regression | focused `FileViewPanel` / `FileMarkdownPreview` tests |
| Mermaid no-flicker | rendered tab survives same-content rerender/remount without source/loading flash |
| Rendering correctness | table/list/math/Mermaid/flowchart/code block fixtures keep expected rendered semantics |
| Annotation overlay | annotation typing does not call markdown compile again |
| Partial refresh | annotation/hover/scroll/same-content refresh does not recreate unrelated block subtrees |
| Interaction state islands | table horizontal scroll and annotation draft focus/value survive parent rerender |
| External sync stability | pending external change does not replace preview DOM in default read mode |
| Large markdown | deterministic degradation/progressive/virtualized path covered by test or perf smoke |
| Large file governance | `npm run check:large-files:gate` if touched files grow near policy limits |

## Rollback Strategy

Keep the previous direct `ReactMarkdown` render path behind a narrow adapter during implementation. Rollback by routing `FileMarkdownPreview` back to the old full render path while leaving spec artifacts as incomplete until a corrected implementation lands.
