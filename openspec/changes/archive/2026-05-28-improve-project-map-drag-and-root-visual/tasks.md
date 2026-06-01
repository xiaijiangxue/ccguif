## 1. Graph Drag Interaction

- [x] 1.1 [P0][输入: node pointer capture move/end][输出: shared node drag move/end handlers][验证: ProjectMapPanel focused test] 节点本体收到 pointer move/up 时也能拖动并持久化。
- [x] 1.2 [P0][输入: nested node action button][输出: button click 不触发 drag][验证: existing drill tests / focused regression] 保持 drill up/down action 与拖拽互不干扰。
- [x] 1.3 [P0][输入: duplicated ProjectMapNode.id across lens payloads][输出: topology-level deduped node set][验证: persistence + incremental generation focused tests] 同一稳定节点 id 跨 lens 重复出现时只渲染一个 graph node，并合并 topology/evidence。

## 2. Root Visual Hierarchy

- [x] 2.1 [P1][输入: root node `.is-core`][输出: stronger root-card visual style][验证: CSS/test smoke] 用尺寸、边框、halo、badge 对 Root 建立顶层视觉层级。

## 3. Verification

- [x] 3.1 [P0][依赖: 1.* 2.*][输出: focused Vitest][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1`] 验证 graph drag/root UI。
- [x] 3.2 [P0][依赖: 1.* 2.*][输出: OpenSpec strict validate][验证: `openspec validate improve-project-map-drag-and-root-visual --strict`] 验证 artifact。
- [x] 3.3 [P1][依赖: 1.* 2.*][输出: typecheck][验证: `npm run typecheck`] 验证类型闭环。
