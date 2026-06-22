---
title: 提示词
description: 面向让 AI agent 处理 Common Admin 的人类任务提示词。
draft: false
---

当要求 AI agent 修改 Common Admin 时，请使用任务提示词。

## 添加管理资源

### 何时使用

当添加新的 API 支持管理模块，并需要持久化、列表/详情行为、表单、路由/菜单项、权限和测试时使用。

### 必读文档

- [架构](../architecture/)
- [CRUD 资源](../patterns/crud-resource/)
- [API 契约](../patterns/api-contract/)
- [RBAC](../patterns/rbac/)
- [AI 指南](../ai/)

### 提示词

```text
向 Common Admin 添加一个新的 API 支持管理资源。

编辑前，阅读架构、API 契约生成、CRUD 资源和 RBAC 权限的公开文档。遵循现有模块模式。将后端 DTO 和 Swagger metadata 作为 API 契约来源，重新生成前端 API，并在 admin app 中使用生成的 helpers。添加聚焦测试并运行相关质量门禁。
```

### 预期验证

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

当资源触及认证、权限、请求流或 e2e 覆盖的路由时，还要运行 `pnpm --filter api test:e2e`。

## 修改 API 契约

### 何时使用

当修改现有端点、DTO、operation id、请求 query、响应形状、生成的前端函数或生成的 schema 类型时使用。

### 必读文档

- [架构](../architecture/)
- [API 契约](../patterns/api-contract/)
- [AI 指南](../ai/)
- 受影响的功能代码和生成的 API 用法。

### 提示词

```text
修改 Common Admin 中的现有 API 契约。

先更新后端 DTO、validation、mappers、controller metadata 和测试。重新生成 OpenAPI 和前端 API 产物。不要手动编辑生成文件。通过生成的类型和函数更新前端用法。完成前运行 API 漂移检查。
```

### 预期验证

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

当契约变更影响认证、权限、全局请求行为或 e2e 覆盖的端点时，还要运行 `pnpm --filter api test:e2e`。

## 引导新项目

### 何时使用

当从 Common Admin 派生一个产品，并在不改变核心架构的情况下重命名或配置 starter 时使用。

### 必读文档

- [介绍](../introduction/)
- [快速开始](../getting-started/)
- [架构](../architecture/)
- [AI 指南](../ai/)

### 提示词

```text
从 Common Admin 引导一个产品。

除非人类维护者明确改变架构，否则保持 authentication、RBAC、generated API flow 和 quality gates 完整。重命名面向产品的 labels 和 environment values，然后通过文档化的 CRUD 和 permission patterns 添加业务模块。
```

### 预期验证

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

使用 `pnpm quality` 检查分支级就绪状态。

## 更新文档 / AI 入口表面

### 何时使用

当修改公开文档、`llms.txt`、`llms-full.txt`、计划中的 MCP 文档、可安装 skill 文档或任务提示词时使用。

### 必读文档

- [介绍](../introduction/)
- [架构](../architecture/)
- [AI 指南](../ai/)
- [MCP 服务器](../ai/mcp-server/)
- [技能](../ai/skill/)
- [反馈](../feedback/)

### 提示词

```text
更新 Common Admin 公开文档或 AI 入口表面。

让公开文档聚焦于稳定的架构、工作流和 agent 指导。不要暴露内部流程材料、环境文件、仓库元数据、依赖或生成的构建输出。将 docs/superpowers/** 和 docs/next-step.md 视为 public docs、llms files、MCP tools 和 installable skills 的禁止来源。总结模式时，编写稳定摘要，而不是复制内部计划或规格。
```

### 预期验证

```bash
pnpm --filter docs build
```

仅当文档变更同时修改代码、脚本、生成产物或 package 配置时，才运行更广泛的仓库检查。
