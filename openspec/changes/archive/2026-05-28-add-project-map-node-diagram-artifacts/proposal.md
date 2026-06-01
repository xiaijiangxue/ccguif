## Why

Project Knowledge Map 的节点详情已经能承载结构化事实，但部分节点本质上描述的是流程、分层、依赖或状态流转；继续用长文本表达会降低可读性，也会把 inspector 推向文档面板。

本变更让 AI 在生成节点详情时先选择表达方式：普通事实继续用短文本，真正需要关系/顺序说明的节点生成 Mermaid Markdown 图解 artifact，并通过节点详情 link 打开。

## 目标与边界

- 节点详情新增图解 artifact link 能力，图解内容落盘为 Markdown + Mermaid。
- 生成 prompt 增加精简的 representation decision，不鼓励无证据、装饰性或重复性图。
- 复用现有文件打开与 Markdown Mermaid Preview，不在 Project Map inspector 内实现第二套 Mermaid renderer。
- 保持 Project Map 节点 JSON 短小：节点只保存 diagram metadata/link，Mermaid 源码写入 sidecar Markdown 文件。

## 非目标

- 不做人工 Mermaid 编辑器。
- 不把所有节点都强制生成图。
- 不生成图片、SVG 文件或远程资源。
- 不改变 FileMarkdownPreview 的 Mermaid 渲染契约。
- 不实现跨项目 diagram gallery 或导出/分享。

## What Changes

- 扩展 Project Map AI 输出契约，允许返回 `diagrams[]`，每条 diagram 绑定一个 `nodeId`、标题、类型、摘要、source refs 与 Mermaid 源码。
- 扩展节点详情模型，新增 `detail.diagramArtifacts[]`，只保存可打开的 Markdown artifact link。
- Project Map worker 将 AI 返回的 Mermaid 转换为 `.ccgui/project-map/<storage-key>/diagrams/<slug>.md`。
- Project Map persistence 和 Tauri allowlist 允许 `diagrams/manifest.json` 与 `diagrams/*.md`。
- 节点 inspector 新增 Diagrams 区域，用 link-style chip/button 复用现有 `onOpenEvidenceFile` 打开 Markdown 文件。
- 生成 prompt 增加精简 representation rules：只在流程、状态、依赖、分层、数据移动等场景生成图；定义/事实/短风险继续用文本。

## 技术方案对比

| 方案 | 描述 | 优点 | 代价 | 取舍 |
|---|---|---|---|---|
| A. 在 inspector 内直接渲染 Mermaid | 节点 detail 直接包含 Mermaid 并在详情区渲染 | 打开快 | 重复 FileMarkdownPreview 能力，inspector 变重，节点 JSON 膨胀 | 不采用 |
| B. Mermaid 写入 sidecar Markdown，节点只存 link | AI 输出 diagram payload，worker 落盘 Markdown，详情展示 link | 复用文件预览，职责清晰，artifact 可版本化 | 需要扩展 persistence allowlist 与序列化 | 采用 |
| C. 只调整 prompt，把 Mermaid 塞进 relatedArtifacts/excerpt | 代码改动少 | schema 语义混乱，link 与内容无法稳定落盘 | 不采用 |

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `project-xray-panel`: Project Knowledge Map 节点详情可链接到 evidence-backed Mermaid Markdown diagram artifacts。

## Impact

- Affected code:
  - `src/features/project-map/types.ts`
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - `src/features/project-map/services/projectMapPersistence.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src-tauri/src/project_map.rs`
  - `src/i18n/locales/*.part5.ts`
  - focused Project Map tests
- Dependencies:
  - 不新增外部依赖，复用已有 Mermaid markdown preview。
- Cross-layer contract:
  - Tauri Project Map write allowlist 新增 `diagrams/manifest.json` 与 `diagrams/*.md`。
  - Frontend Project Map dataset 新增 optional diagram artifact collections，旧快照 fallback 为空集合。

## 验收标准

- AI prompt 明确要求内部判断表达方式，仅在图能提升关系/顺序理解时生成 Mermaid。
- AI 输出可包含 `diagrams[]`；无图需求时允许省略或返回空数组。
- 图解 Markdown 文件写入 Project Map storage root 的 `diagrams/` 目录，路径受 Tauri allowlist 约束。
- 节点详情展示 diagram link，点击后打开现有文件/Markdown 预览链路。
- 旧 Project Map 快照没有 diagram 字段时仍可读取和渲染。
- Mermaid 源码不进入 inspector 直接渲染，也不作为长文本塞进 `coreDescription/keyFacts/keyLogic`。
