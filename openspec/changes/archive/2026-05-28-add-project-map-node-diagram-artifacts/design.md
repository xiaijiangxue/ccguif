## Context

Project Knowledge Map 当前生成 `profile/lenses/nodes` JSON，节点详情固定包含 core description、key facts、key logic、risk signals 和 related artifacts。详情面板已支持 link-style trace chip，并能通过 `onOpenEvidenceFile` 打开 workspace 文件。文件预览链路已经支持 Markdown Mermaid fenced block 渲染。

当前缺口不是 Markdown 渲染能力，而是生成与落盘契约：AI 没有一个克制的 representation decision，也没有 sidecar diagram artifact 的写入位置。若直接把 Mermaid 塞进节点 detail，会让节点 JSON 膨胀并污染 inspector 职责。

## Goals / Non-Goals

**Goals:**

- 在 Project Map prompt 中加入短小、连贯的 representation rules，让模型先内部判断文本/图解哪种表达更合适。
- 允许 AI 输出 `diagrams[]`，但只在流程、状态、依赖、分层或数据移动等图解更清晰的场景生成。
- 将 Mermaid 源码写成 `diagrams/*.md` sidecar Markdown 文件。
- 节点详情只展示 diagram artifact link，点击复用现有文件/Markdown preview。
- 旧数据无 diagrams 时保持兼容。

**Non-Goals:**

- 不实现 inspector 内 Mermaid renderer。
- 不生成装饰性图、图片或 SVG artifact。
- 不新增外部依赖。
- 不做人工编辑或 diagram diff editor。

## Decisions

### Decision 1: Diagram 是 sidecar artifact，不是 node detail body

节点 detail 继续保持短文本结构。AI 返回的 `diagrams[]` 经 worker 规范化后写入 `diagrams/<slug>.md`，节点只保存 `detail.diagramArtifacts[]`。

Alternative：直接在 `coreDescription` 或 `keyLogic` 中嵌入 fenced Mermaid。问题是 detail 面板不渲染 Markdown，也会让节点 JSON 承载大段源码。

### Decision 2: Prompt 增加表达选择器，而不是长规则清单

新增 prompt 段落只表达一个思路：

1. 先内部判断节点解释对象。
2. 定义/事实/短风险用文本。
3. 流程、状态、依赖、分层、数据移动才用 Mermaid。
4. 图若重复 `keyFacts/keyLogic` 就省略。
5. 弱证据或 unknown claim 不生成图。

这比堆大量 Mermaid 格式规则更稳定，也更符合现有 Project Map 生成器的 evidence-first 风格。

### Decision 3: Persistence allowlist 最小扩展

Rust `project_map_write_snapshot` 只新增：

- `diagrams/manifest.json`
- `diagrams/<safe-segment>.md`

不允许 nested diagram directories，不允许任意扩展名，继续复用现有 safe segment 校验。

### Decision 4: UI 复用 trace chip 打开链路

ProjectMapPanel 在 node detail 中新增 Diagrams section，使用现有 link-style chip/`onOpenEvidenceFile` 打开 Markdown 文件。没有 diagram artifacts 的节点不展示该 section。

Alternative：新增独立 diagram preview panel。当前 YAGNI，且会重复 FileMarkdownPreview 的 Mermaid source/render tab 能力。

## Risks / Trade-offs

- [Risk] 模型过度生成图。→ Mitigation：prompt 明确“only when clearer than text / decorative diagrams omitted”，并允许 `diagrams` 为空。
- [Risk] Mermaid 源码非法导致预览失败。→ Mitigation：artifact 仍是 Markdown 文件，FileMarkdownPreview 已有 Mermaid render/source fallback；节点 link 不会破坏地图。
- [Risk] 新字段破坏旧快照。→ Mitigation：sanitize 时默认 `diagrams=[]`、`detail.diagramArtifacts=[]`。
- [Risk] Project Map storage allowlist 放宽过度。→ Mitigation：只允许单层 `.md` 和 manifest，不开放任意 path。

## Migration Plan

1. 扩展 types / sanitize / serialize，旧数据 fallback 为空数组。
2. 扩展 worker prompt、AI payload parser、diagram Markdown artifact builder。
3. 扩展 Rust allowlist 与 tests。
4. 扩展 ProjectMapPanel diagram link rendering 与 focused tests。
5. 运行 focused Vitest、Rust test、OpenSpec strict validation。

Rollback：移除 diagram fields、serialization、allowlist 和 UI section。已存在 `diagrams/*.md` 为无害 sidecar 文件，不影响旧 Project Map read path。

## Open Questions

- 后续是否需要 diagram apply/reject 独立审核状态；本轮不做。
- 后续是否需要支持多个 diagram 文件按 node 分组显示；本轮以单层 `diagrams/*.md` 足够。
