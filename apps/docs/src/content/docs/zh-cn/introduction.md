---
title: Common Admin
description: 面向使用智能体构建生产级管理系统团队的 AI 友好管理后台起点。
draft: false
---

Common Admin 是一个可复用的管理后台起点，围绕 NestJS API、React 管理应用、RBAC 权限、OpenAPI 生成和质量门禁构建。

它旨在作为生产级管理后台的起点，而不是演示脚手架。该模板保留了内部运营产品中枯燥但重要的部分：身份认证、refresh-token 会话、感知权限的导航、生成的 API 客户端、数据库迁移、测试，以及可重复执行的验证命令。

项目面向两类读者设计：

- 希望获得实用管理后台基础的开发者。
- 在修改前需要稳定项目上下文的 AI 智能体。

这份公开文档刻意与仓库内部工作笔记分离。它公开的是稳定架构、工作流和智能体指令，这些内容在开发过程之外也有用。

## 核心承诺

- **NestJS API**：后端模块负责持久化、校验、业务逻辑、认证、RBAC、OpenAPI 元数据和错误行为。
- **React 管理应用**：前端页面使用生成的 API 函数、schema 类型、查询 hooks 和 query key helpers。
- **Prisma 持久化**：schema 和迁移描述 API 模块的数据库形态。
- **RBAC 权限**：管理能力使用稳定的 `module.action` 权限代码，而不是角色名称检查。
- **OpenAPI 契约流**：后端 DTO 和 Swagger 元数据生成 `apps/api/openapi.json`，再由它生成前端 API 客户端。
- **生成客户端边界**：生成产物会提交以便审查，但对人类和智能体来说是只读的。
- **质量门禁**：变更应通过 API 漂移检查、lint、测试、相关 API e2e 测试和构建。

## 包含内容

- 身份认证和 refresh-token 会话处理。
- RBAC 用户、角色、权限和路由守卫。
- 组织、部门、职位和数据权限基础。
- 字典、文件管理、审计日志和系统设置。
- OpenAPI 契约生成和生成的前端 API 客户端。
- 面向 AI 的任务协议，用于可重复的项目变更。

开发者主题指南覆盖通常会影响多个模块的运营面：

- [部署](./deployment/)：Docker Compose、迁移、种子行为和仅部署配置。
- [升级指南](./upgrade-guide/)：安全推进部署或派生项目。
- [发布检查清单](./release-checklist/)：分支和发布就绪度。
- [认证与会话](./auth-and-sessions/)：登录、刷新、退出、cookie 和 401 重放行为。
- [会话管理](./session-management/)：管理员列出和撤销用户会话。
- [错误与日志](./errors-and-logging/)：错误信封、请求 ID、结构化日志和脱敏。
- [诊断与健康检查](./diagnostics-and-health/)：健康检查和诊断请求流验证。
- [审计日志](./audit-logs/)：问责记录和 payload 清理。
- [设置](./settings/)：运行时可编辑设置和仅部署配置边界。
- [文件管理](./file-management/)：上传/下载契约和存储安全。
- [质量门禁](./quality-gates/)：验证命令和分支就绪度。
- [故障排查](./troubleshooting/)：常见的设置、认证、API 漂移、迁移、上传和文档构建失败。
- [FAQ](./faq/)：Common Admin 常见问题的快速答案。

模块指南覆盖 starter 提供的资源：

- [用户、角色与权限](./users-roles-permissions/)：身份、角色分配、权限目录和会话管理。
- [组织结构](./organization-structure/)：部门和职位。
- [数据权限](./data-permissions/)：按部门限定的用户可见性规则。
- [字典](./dictionaries/)：托管选项列表和选项端点。
- [资源工作流](./resource-workflow/)：添加 API 支撑的管理模块的公开端到端流程。
- [公开 AI 界面](./public-ai-surfaces/)：docs、llms 文件、MCP、反馈和 CI 边界。

## 公开文档边界

公开文档描述稳定的 starter 架构和工作流。它们不得暴露密钥、本地环境文件、生成的构建输出或内部规划历史。

特别是，`docs/superpowers/**` 是内部历史过程材料。它可以帮助维护者理解项目是如何构建的，但它不是公开指南，也不得作为公开文档、`llms.txt`、`llms-full.txt`、MCP 工具或可安装技能的来源。

## 从哪里开始

- 阅读[入门](./getting-started/)以在本地运行项目。
- 阅读[架构](./architecture/)以理解系统形态。
- 阅读 [FAQ](./faq/) 获取快速答案。
- 当设置、API 漂移、认证或文档构建行为不清楚时，阅读[故障排查](./troubleshooting/)。
- 在认为分支就绪前，阅读[质量门禁](./quality-gates/)。
- 在要求智能体修改项目之前，阅读 [AI 指南](./ai/)。
