## 1. Runtime Branching

- [x] 1.1 P0 输入: `handleAddWorkspace` 当前 desktop picker 流程；输出: Web service runtime 分支在调用 `pickWorkspacePath` 前被识别；验证: Web runtime 测试断言不调用 Tauri directory picker。
- [x] 1.2 P0 输入: 用户手动输入的远端路径；输出: 非空 trim 后路径传入 `handleAddWorkspaceFromPath(path)`；验证: focused test 断言 `/home/user/project` 被传给 `addWorkspaceFromPath`。
- [x] 1.3 P0 输入: 用户取消输入、输入空字符串或纯空白；输出: 不创建 workspace、不触发 loading success、不调用 `addWorkspaceFromPath`；验证: focused test 覆盖 cancel/blank path。

## 2. Desktop Behavior Preservation

- [x] 2.1 P0 输入: Desktop Tauri runtime 添加工作区；输出: 继续调用 `pickWorkspacePath()` 获取目录；验证: existing/focused test 断言 desktop path 仍来自 picker。
- [x] 2.2 P1 输入: Desktop Tauri runtime 获取到 path 后的打开模式选择；输出: `加入当前窗口` / `新开窗口` 分流保持不变；验证: focused test 或既有测试覆盖 current-window 与 new-window routing 不回归。
- [x] 2.3 P1 输入: 图片选择、普通文件选择或其它 picker 调用；输出: 不受 Web service 添加工作区分支影响；验证: 静态检查确认未修改通用 `plugin:dialog|*` shim 或通用 picker contract。

## 3. User Feedback And Copy

- [x] 3.1 P1 输入: Web service runtime 手动路径输入 UI；输出: 文案明确提示输入 daemon 所在机器的绝对路径；验证: i18n key 覆盖 zh/en，UI 不硬编码用户可见文案。
- [x] 3.2 P1 输入: daemon/runtime 返回路径不存在或不是 folder 的错误；输出: 继续通过现有添加失败提示展示，不新增并行错误通道；验证: focused test 或代码审查确认 error path 复用 `handleAddWorkspaceFromPath`。

## 4. Validation

- [x] 4.1 P0 输入: OpenSpec artifacts；输出: `openspec validate --all --strict --no-interactive` 通过；验证: 记录命令结果。
- [x] 4.2 P0 输入: frontend behavior change；输出: focused Vitest suite 覆盖 Web runtime path entry 与 desktop fallback；验证: 运行对应 test 文件。
- [x] 4.3 P1 输入: TypeScript frontend change；输出: 类型检查无新增错误；验证: `npm run typecheck` passed on 2026-05-30.
