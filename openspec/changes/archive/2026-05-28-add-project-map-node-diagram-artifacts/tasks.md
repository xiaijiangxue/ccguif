## 1. OpenSpec Contract

- [x] 1.1 [P0][依赖: proposal/design/spec][输入: add-project-map-node-diagram-artifacts artifacts][输出: strict-valid change][验证: `openspec validate add-project-map-node-diagram-artifacts --strict`] 完成节点图解 artifact contract。

## 2. Data Model And Persistence

- [x] 2.1 [P0][依赖: 1.1][输入: Project Map types/persistence][输出: diagram artifact types, sanitize, serialize][验证: `npm exec vitest -- run src/features/project-map/services/projectMapPersistence.test.ts`] 扩展 dataset 读取写入和旧快照 fallback。
- [x] 2.2 [P0][依赖: 2.1][输入: Tauri project_map write boundary][输出: diagrams allowlist][验证: `cargo test --manifest-path src-tauri/Cargo.toml project_map`] 限制允许 `diagrams/manifest.json` 与 `diagrams/*.md`。
- [x] 2.3 [P0][依赖: 2.2][输入: 并发补全写入][输出: unique atomic temp path][验证: `cargo test --manifest-path src-tauri/Cargo.toml project_map`] 修复同进程并发提交同一路径时 temp 文件名冲突。

## 3. Generation Prompt And Worker

- [x] 3.1 [P0][依赖: 2.1][输入: Project Map worker prompt][输出: concise representation rules][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts`] 增加文本/图解表达选择器。
- [x] 3.2 [P0][依赖: 3.1][输入: AI payload diagrams][输出: Markdown sidecar artifacts + node links][验证: `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/incrementalGeneration.test.ts`] 解析 diagram payload 并合并到节点详情。

## 4. Inspector UX

- [x] 4.1 [P1][依赖: 2.1,3.2][输入: ProjectMapPanel node detail][输出: Diagrams link section][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx`] 复用现有文件打开链路展示 diagram artifacts。
- [x] 4.2 [P1][依赖: 4.1][输入: zh/en i18n][输出: diagram section copy][验证: focused component tests] 补齐用户可见文案。
- [x] 4.3 [P0][依赖: 4.1][输入: Project Map storage-root absolute paths][输出: external absolute read/preview roots include Project Map roots][验证: `cargo test --manifest-path src-tauri/Cargo.toml read_external_absolute_file resolve_external_preview_handles_respect_allowed_roots_and_openspec_aliases`] 修复图解 Markdown sidecar 打不开。

## 5. Validation

- [x] 5.1 [P0][依赖: 2.*,3.*,4.*][输入: focused tests][输出: tests pass][验证: focused Vitest + cargo project_map tests] 运行聚焦验证。
- [x] 5.2 [P0][依赖: 5.1][输入: OpenSpec change][输出: strict validation pass][验证: `openspec validate add-project-map-node-diagram-artifacts --strict`] 完成 OpenSpec 校验并更新任务状态。
