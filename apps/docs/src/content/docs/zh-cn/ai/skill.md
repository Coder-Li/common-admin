---
title: 技能
description: 计划中的可安装 skill，用于修改 Common Admin 项目的 AI agent。
draft: false
---

Common Admin 技能应该教会 agent 如何在由这个 starter 派生出的项目中工作。

它应该充当 agent 工作流路由器。它不会替代文档、复制全部项目指导，或成为隐藏的事实来源。它的职责是让 agent 阅读正确的公开文档、检查当前仓库、遵守事实来源边界，并在声明完成前完成验证。

该技能应引导 agent 完成：

- 必读顺序。
- 事实来源文件。
- 生成产物规则。
- 新管理资源工作流。
- API 契约变更工作流。
- 权限命名和执行规则。
- 验证命令。

## 必读顺序

1. `/ai/`
2. `/architecture/`
3. 来自 `/ai/prompts/` 的相关任务提示词
4. 相关模式文档：
   - `/patterns/api-contract/`
   - `/patterns/crud-resource/`
   - `/patterns/rbac/`
5. 受影响模块的当前源文件。
6. 受影响模块的现有测试。

## 技能边界

该技能不应替代项目文档。它应该将 agent 路由到正确的公开文档，并强制执行安全工作流。如果公开文档和本地源码似乎不一致，agent 应检查源码、报告不一致，并避免发明第三套工作流。

该技能应只暴露稳定的公开指导。它绝不能读取、引用、总结或打包内部流程材料作为说明。

## 预期行为

当 agent 收到类似 “add a new admin resource” 的任务时，它应该：

1. 阅读架构概览。
2. 阅读 CRUD、RBAC 和 API 契约模式。
3. 检查现有模块。
4. 先通过后端契约实现。
5. 重新生成 API clients。
6. 使用生成的 helpers 添加前端页面。
7. 运行验证命令。

## 禁止操作

- 不要手动编辑 `apps/api/openapi.json`。
- 不要手动编辑 `apps/admin/src/generated/api/`。
- 不要为生成的端点创建手写的前端 API clients。
- 不要为管理能力添加基于角色名称的检查。
- 不要暴露 `.env*`、`.git/**`、`node_modules/**`、`apps/docs/dist/**` 或 `apps/docs/.astro/**`。
- 不要将 `docs/superpowers/**` 或 `docs/next-step.md` 用作公开 skill 内容或公开指导。
- 当权限命名、契约形状或迁移安全性不清楚时，不要静默继续。

## 最终回复格式

Agent 的最终回复应简短且基于证据：

```text
Changed:
- <public summary of files or behavior changed>

Verified:
- <command>: <result>

Notes:
- <blockers, skipped checks, or follow-up risks>
```

如果没有运行验证，回复必须说明跳过了哪个命令以及原因。
