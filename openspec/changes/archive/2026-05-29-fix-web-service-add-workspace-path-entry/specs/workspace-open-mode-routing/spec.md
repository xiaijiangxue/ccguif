## ADDED Requirements

### Requirement: Web service 添加工作区必须提供手动远端路径入口

系统 MUST 在 Web service runtime 下为“添加工作区”提供手动输入远端路径的入口，并 MUST NOT 依赖本机 Tauri directory picker 获取路径。

#### Scenario: web service add workspace with remote absolute path
- **WHEN** 用户在 Web service runtime 下触发“添加工作区”并输入非空远端路径
- **THEN** 系统 MUST 将该路径交给既有当前窗口导入流程
- **AND** 系统 MUST 复用现有 workspace 去重、loading、错误提示与激活行为

#### Scenario: web service add workspace cancelled or blank
- **WHEN** 用户在 Web service runtime 下取消路径输入或提交空白路径
- **THEN** 系统 MUST NOT 创建 workspace
- **AND** 系统 MUST NOT 显示成功导入状态

#### Scenario: web service add workspace rejects local picker dependency
- **WHEN** 用户在 Web service runtime 下触发“添加工作区”
- **THEN** 系统 MUST NOT 调用本地 Tauri directory picker 作为必需路径来源
- **AND** 系统 MUST NOT 因 `plugin:dialog|*` 返回 `null` 而静默丢失添加操作

### Requirement: Web service 手动路径入口不得扩大远程文件系统能力

系统 MUST 将 Web service 手动路径入口限定为路径文本采集与既有导入流程转发，不得在本变更中引入远程文件浏览、路径映射或 daemon RPC 协议变更。

#### Scenario: remote path validation remains daemon-owned
- **WHEN** Web service runtime 下用户提交的远端路径不存在或不是目录
- **THEN** 系统 MUST 继续展示 daemon/runtime 既有校验错误
- **AND** frontend MUST NOT 通过客户端本地文件系统判断该远端路径是否为目录

#### Scenario: desktop picker behavior remains unchanged
- **WHEN** 用户在 Desktop Tauri runtime 下触发“添加工作区”
- **THEN** 系统 MUST 继续使用既有 directory picker 与打开模式分流
- **AND** Web service 手动路径入口 MUST NOT 改变图片选择、文件选择或其它 picker 行为
