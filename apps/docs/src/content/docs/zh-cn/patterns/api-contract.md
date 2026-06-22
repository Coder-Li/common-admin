---
title: API 契约
description: 后端契约如何流转为生成的前端 API helper。
draft: false
---

Common Admin 使用后端优先的 API 契约。

## 事实来源

- Prisma models 定义持久化。
- DTOs 和 validation 定义请求与响应形态。
- Swagger metadata 定义 operation ids、响应 schemas、auth metadata、multipart bodies 和 binary responses。
- `apps/api/openapi.json` 是生成产物。
- `apps/admin/src/generated/api/` 从 OpenAPI 生成。

不要手动编辑生成产物：

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

如果生成输出看起来不正确，请修复后端 DTO、Swagger metadata、OpenAPI generation helper 或 Orval config，然后重新生成。

## 变更流程

1. 更新后端源文件。
2. 更新 DTO validation 和 Swagger metadata。
3. 添加或保留显式 operation ids。
4. 运行 API 生成。
5. 通过生成的 helper 更新前端用法。
6. 运行 API drift 检查。

```bash
pnpm api:generate
pnpm api:check
```

绝不要为了满足 TypeScript 而修补生成文件。请修复源契约。

## Operation IDs

每个生成端点都必须有稳定且显式的 Swagger operation id：

```ts
@ApiOperation({ operationId: 'listUsers' })
```

Operation ids 会成为生成的前端 function、hook 和 query key helper 名称。除非重命名本身就是任务目的，否则应将重命名 operation id 视为破坏性 API-client 变更。

推荐规则：

- 使用清晰的动作名称，例如 `listArticles`、`getArticle`、`createArticle`、`updateArticle` 和 `deleteArticle`。
- 在已有公开前端用法后保持名称稳定。
- 当新的生成端点应受到 operation-id 检查保护时，添加或更新 OpenAPI 断言覆盖。

## 无前缀路径

运行时 API 路由使用 `/api` 前缀，但生成的 OpenAPI 路径必须保持无前缀。

正确的生成路径：

```text
/auth/login
/users
/files/{id}/download
```

错误的生成路径：

```text
/api/auth/login
/api/users
/api/files/{id}/download
```

前端会将 `VITE_API_BASE_URL`（默认是 `/api`）与生成路径组合。如果 OpenAPI 包含 `/api`，浏览器请求就会变成 `/api/api/...`。

## 后端检查清单

对于每个生成端点，请验证：

- 对 body 或 query 输入存在请求 DTO。
- 对 JSON 响应存在响应 DTO。
- 运行时校验使用 `class-validator` decorators。
- DTO 字段具有 Swagger metadata，例如 `@ApiProperty` 或 `@ApiPropertyOptional`。
- Controller methods 定义 `@ApiOperation({ operationId })`。
- Controller methods 定义响应 decorators，例如 `@ApiOkResponse`、`@ApiCreatedResponse` 或 `@ApiNoContentResponse`。
- 已认证端点声明 bearer-auth metadata。
- 管理端端点声明匹配的 `@Permissions('<module>.<action>')`。
- Multipart upload 和 binary download 端点具有显式 Swagger metadata。

## 前端规则

前端 API 用法应通过生成输出：

- 来自 `apps/admin/src/generated/api/endpoints/` 的 endpoint functions 和 hooks；
- 来自 `apps/admin/src/generated/api/schemas` 的 schema types；
- 用于 invalidation 的生成 query key helpers。

功能本地类型应仅限于 UI-only state、form values、selected rows，或围绕生成 schema types 的 aliases。不要在功能文件中重复后端 DTO 形态。

只有当功能本地 API facade 进行真正的页面级组合时才合适，例如组合操作、将生成 DTO 映射为 UI-only models、协调多步 mutation，或围绕生成的 download operation 包装浏览器文件保存行为。不要添加只有一个方法的转发 wrapper。

## 排障

`pnpm api:generate` 会重新生成后端 OpenAPI 文档和管理端生成客户端。

`pnpm api:check` 会运行生成，并在已提交的生成输出过期时失败：

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

常见修复：

- 生成的 import name 发生变化：检查并稳定后端 operation id。
- 请求路径是 `/api/api/...`：保持生成的 OpenAPI 路径无前缀。
- 前端类型太弱：添加缺失的 DTO 字段、validation decorators 或 Swagger metadata。
- 上传不是 `FormData`：检查 multipart Swagger metadata 和 Orval upload config。
- 下载不是 `Blob`：检查 binary response metadata 和 Orval download override。
- OpenAPI 生成触达外部服务：继续之前调整 generation-safe providers。

如果生成 diff 符合预期，请将重新生成的产物与源契约变更一起提交。如果不符合预期，请修改后端契约或 Orval config 并重新生成。
