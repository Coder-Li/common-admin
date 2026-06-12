# Common Admin 后续事项临时清单

> 这是一个临时讨论索引，用来把当前工程从“基础管理后台启动模板”逐步推进成更稳、更易复用的后台底座。

创建日期：2026-06-09

## 当前判断

这个项目已经可以作为基础的前后端分离管理后台启动模板使用。当前已有 React 管理端、NestJS API、JWT 登录鉴权、角色守卫、用户管理、字典管理、文件管理、主题切换、国际化、Swagger、Prisma migration/seed、CRUD 表格约定和较完整的基础测试。

后续工作不需要急着堆业务功能，重点应该放在：安全性、可扩展性、团队复用体验、部署运行体验和工程约束。

## 建议讨论顺序

### 1. 权限体系

当前状态：RBAC 权限体系已经完成第一版实现，包含后端权限表、系统权限 seed、`@Permissions()` guard、多角色用户 API、角色管理 API、前端 session 权限上下文、权限感知菜单/路由、`/403`、角色管理页面，以及 users / dictionaries / files 的动作权限控制。

设计与实施文档：

- `docs/superpowers/specs/2026-06-09-rbac-permission-design.md`
- `docs/superpowers/plans/2026-06-09-rbac-permission.md`
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

后续可讨论：

- 是否加入审计日志记录角色/权限变更。
- 是否提供更细的权限模板或批量复制角色能力。
- 是否把前端路由迁移到 TanStack Router，同时保留现有 route metadata 作为菜单和权限来源。
- 是否加入 Playwright 登录后角色管理端到端冒烟测试。

价值：这是“演示型后台”和“可复用业务后台底座”之间最关键的差异。

### 2. 认证与会话生命周期

当前状态：登录后签发 access token。

后续可讨论：

- 是否支持 refresh token。
- 退出登录是否需要服务端失效会话。
- 修改密码流程。
- 重置密码流程。
- 前端 token 过期后的交互体验。
- Redis 是否用于保存 refresh/session 状态。

价值：access-token-only 对本地启动模板够用，但真实项目通常需要更完整的会话治理。

### 3. 审计日志 / 操作日志

当前状态：资源有 `createdAt` 和 `updatedAt`，但没有通用操作日志。

后续可讨论：

- 哪些操作需要记录。
- 日志字段：操作人、动作、资源类型、资源 ID、请求元信息、变更前后快照。
- 审计日志是否只追加、不允许修改。
- 后台是否提供日志查询和筛选页面。
- 快照中如何排除敏感数据。

价值：后台系统通常需要可追溯性，尤其是用户、文件、字典、权限等模块。

### 4. 前端路由与菜单架构

当前状态：前端依赖里已经有 TanStack Router，但当前路由仍是手写 path/history 分发。

后续可讨论：

- 是否迁移到 TanStack Router。
- 是否把路由定义作为菜单配置的数据源。
- 认证守卫和权限守卫放在哪里。
- 404 和无权限页面如何处理。
- 面包屑和页面元信息如何维护。

价值：手写路由在小规模下没问题，但作为模板，路由、菜单、权限、页面元信息最好逐步统一。

### 5. 本地开发与部署体验

当前状态：README 说明了本地 Postgres 和 Redis，但没有 Docker Compose 或 CI。

后续可讨论：

- 是否提供 `docker-compose.yml` 管理 Postgres、Redis、API、Admin。
- 是否提供生产构建用 Dockerfile。
- 是否接入 GitHub Actions 或其他 CI。
- 标准命令：安装、lint、test、build、migrate、seed。
- 环境变量文档是否需要统一整理。

价值：启动模板应该尽量做到 clone 后容易运行、容易验证、容易部署。

### 6. API 契约与类型生成

当前状态：API 契约与类型生成已经完成第一版实现。后端 DTO 和 Swagger metadata 是契约来源，`apps/api/openapi.json` 由脚本生成，Admin 端 API types、endpoint functions、React Query hooks 和 query keys 由 Orval 生成，旧 handwritten API client 已移除。

设计、实施与使用文档：

- `docs/development/common-admin-development-guide.md`
- `docs/superpowers/specs/2026-06-10-api-contract-generation-design.md`
- `docs/superpowers/plans/2026-06-10-api-contract-generation.md`
- `docs/patterns/admin-api-contract-generation-guide.md`

后续可讨论：

- 是否在 CI 中强制执行 `pnpm api:check`。
- 是否为新增 API 模块提供脚手架或更细的 checklist。
- 是否在后续统一异常处理主题中规范 generated mutator 的错误模型。

价值：随着模块增加，自动生成契约能减少重复劳动和隐性字段不一致。

### 7. 统一异常处理与日志

当前状态：NestJS validation、guards 已有，但还没有明显的统一错误响应格式和结构化日志层。

后续可讨论：

- API 错误响应格式。
- Global exception filter。
- request id / correlation id。
- 结构化日志。
- 前端 toast/error 展示规范。
- 表格页、表单、上传、登录过期等场景的错误处理约定。

价值：一致的错误处理会让前端开发、后端排查和线上运维都更顺。

### 8. 系统设置模块

当前状态：前端 settings 页面还是 placeholder。

后续可讨论：

- 启动模板里应该内置哪些设置。
- 站点名称和基础品牌配置。
- 上传限制和允许的 MIME 类型。
- 默认语言和默认主题。
- 字典缓存刷新控制。
- 设置应该落数据库，还是只读取环境变量。

价值：这是把已有基础设施转成可见管理能力的自然入口。

### 9. 测试与质量门禁

当前状态：已有不少单元测试和 UI 测试，根目录也有 test/lint/build 脚本。

后续可讨论：

- 新增 CRUD 模块的最低测试要求。
- auth 和 permission 的 API e2e 覆盖。
- 前端路由守卫和权限测试。
- CI 必须通过哪些检查。
- 是否加入 Playwright 冒烟测试。

价值：当前已经有测试基础，下一步是把它变成模板约束，而不是只靠习惯维持。

### 10. 模板文档与脚手架

当前状态：已有 CRUD 表格模式文档。

后续可讨论：

- 新项目启动 checklist。
- 新资源模块开发 checklist。
- 给 AI 或开发者使用的模块生成提示词。
- 是否做一个可选的 CRUD 代码生成器。
- 前端、后端、数据模型、认证体系的架构总览。

价值：模板最重要的是“可重复”。文档和脚手架能减少每次新增模块时的隐性沟通成本。

## 粗略优先级

高优先级：

- 认证与会话生命周期。
- 审计日志 / 操作日志。
- 本地开发与 CI 设置。

中优先级：

- 前端路由与菜单架构。
- API 契约与类型生成。
- 统一异常处理与日志。
- 系统设置模块。

低优先级：

- Playwright 冒烟测试。
- CRUD 脚手架 / 代码生成。
- 更完整的模板文档和架构图。

## 后续新对话建议

每次新对话只讨论一个主题。可以这样开始：

```text
我们来讨论 Common Admin 的权限体系设计，目标是先定方案，不急着写代码。
```

```text
我们来讨论 Common Admin 的 refresh token 和会话生命周期设计。
```

```text
我们来讨论 Common Admin 的审计日志/操作日志应该怎么设计。
```

```text
我们来讨论 Common Admin 前端路由、菜单和权限配置要不要迁移到 TanStack Router。
```

## 备注

这份文档故意保持临时性。等某一项准备进入实现阶段，再把它整理成正式设计文档，放到 `docs/superpowers/specs/`；之后再拆成实施计划，放到 `docs/superpowers/plans/`。
