---
title: AI 指南
description: AI agent 应如何阅读和修改 Common Admin。
draft: false
---

Common Admin 被设计为对 AI 友好的 starter。Agent 应将公开文档视为稳定的操作上下文，并以仓库源码作为最终依据。

## Agent 阅读顺序

1. 阅读本 AI 指南。
2. 阅读[架构](../architecture/)。
3. 阅读与任务相关的模式指南。
4. 编辑前检查当前代码。
5. 迭代时运行范围最窄且有用的验证命令。
6. 在声明变更完成前运行更广泛的质量门禁。

## 全局规则

- 不要手动修补生成的 API 产物。
- 不要创建一次性的前端 API 客户端。
- 不要为管理能力添加基于角色名称的检查。
- 保持 API 契约、生成客户端、路由元数据和权限一致。
- 优先做小而聚焦于功能的变更，避免大范围重构。

## 任务路由

根据任务类型选择编辑前必须阅读的公开文档：

| 任务 | 必读文档 |
| --- | --- |
| 添加新的 API 支持资源 | [架构](../architecture/), [CRUD 资源](../patterns/crud-resource/), [API 契约](../patterns/api-contract/), [RBAC](../patterns/rbac/), [提示词](../ai/prompts/) |
| 遵循公开资源工作流 | [资源工作流](../resource-workflow/), [CRUD 资源](../patterns/crud-resource/), [API 契约](../patterns/api-contract/), [RBAC](../patterns/rbac/) |
| 修改 API 契约 | [架构](../architecture/), [API 契约](../patterns/api-contract/), 相关功能代码，生成的 API 用法 |
| 从 starter 引导产品 | [介绍](../introduction/), [快速开始](../getting-started/), [架构](../architecture/), [提示词](../ai/prompts/) |
| 修改 RBAC 或权限 | [架构](../architecture/), [RBAC](../patterns/rbac/), 受影响的后端控制器、路由/菜单元数据、页面操作门禁 |
| 修改用户、角色、权限或会话 | [架构](../architecture/), [用户、角色与权限](../users-roles-permissions/), [RBAC](../patterns/rbac/), [认证与会话](../auth-and-sessions/) |
| 修改会话管理 | [会话管理](../session-management/), [认证与会话](../auth-and-sessions/), [审计日志](../audit-logs/) |
| 修改部门、岗位或数据范围 | [架构](../architecture/), [组织结构](../organization-structure/), [数据权限](../data-permissions/), [RBAC](../patterns/rbac/) |
| 修改字典或选项端点 | [架构](../architecture/), [字典](../dictionaries/), [API 契约](../patterns/api-contract/) |
| 修改认证或会话行为 | [架构](../architecture/), [认证与会话](../auth-and-sessions/), 生成的认证 API 用法，认证测试 |
| 修改文件上传或下载行为 | [架构](../architecture/), [文件管理](../file-management/), [API 契约](../patterns/api-contract/), 文件模块测试 |
| 修改设置或上传策略 | [架构](../architecture/), [设置](../settings/), [审计日志](../audit-logs/), 生成的设置 API 用法 |
| 修改错误、请求 ID 或日志 | [架构](../architecture/), [错误与日志](../errors-and-logging/), API e2e 测试 |
| 修改健康检查或诊断行为 | [诊断与健康](../diagnostics-and-health/), [错误与日志](../errors-and-logging/), API e2e 测试 |
| 修改部署脚本或运行时配置 | [部署](../deployment/), [设置](../settings/), [质量门禁](../quality-gates/) |
| 准备升级或发布 | [升级指南](../upgrade-guide/), [发布清单](../release-checklist/), [质量门禁](../quality-gates/) |
| 更新文档或 AI 入口表面 | [介绍](../introduction/), [架构](../architecture/), [公开 AI 表面](../public-ai-surfaces/), [提示词](../ai/prompts/), [MCP Server](../ai/mcp-server/), [Skill](../ai/skill/) |

## 停止条件

在以下情况中，停止并询问维护者，而不是强行变更：

- API 契约不清晰、相互矛盾，或缺少必要的请求/响应细节。
- 权限名称、模块名称、默认角色或操作语义存在歧义。
- 数据库迁移可能删除数据、重写生产记录，或重命名稳定的权限代码。
- 生成产物发生漂移，且与预期的后端源变更不匹配。
- 任务要求暴露内部流程文档、环境文件、构建输出或仓库元数据。

## 有用的公开入口

- `/llms.txt`：简明 AI 索引。
- `/llms-full.txt`：扩展 AI 上下文。
- [部署](../deployment/)：Docker Compose 和迁移流程。
- [升级指南](../upgrade-guide/)：安全升级工作流。
- [发布清单](../release-checklist/)：就绪检查清单。
- [FAQ](../faq/)：快速解答。
- [故障排查](../troubleshooting/)：常见故障诊断。
- [质量门禁](../quality-gates/)：验证命令。
- [资源工作流](../resource-workflow/)：新增 API 支持模块的公开流程。
- [认证与会话](../auth-and-sessions/)：认证生命周期和 401 重放。
- [会话管理](../session-management/)：管理员会话列表和撤销。
- [错误与日志](../errors-and-logging/)：错误信封和请求 ID。
- [诊断与健康](../diagnostics-and-health/)：运行时和错误流程检查。
- [用户、角色与权限](../users-roles-permissions/)：身份和权限资源。
- [组织结构](../organization-structure/)：部门和岗位。
- [数据权限](../data-permissions/)：记录可见性规则。
- [字典](../dictionaries/)：托管选项列表。
- [MCP Server](../ai/mcp-server/)：本地 MCP 接口。
- [公开 AI 表面](../public-ai-surfaces/)：文档、llms、MCP、反馈和 CI。
- [Skill](../ai/skill/)：计划中的可安装 agent skill。
- [提示词](../ai/prompts/)：面向任务的提示词。
