---
title: CRUD 资源
description: 添加 API 支撑管理资源的标准形态。
draft: false
---

普通管理资源横跨 API app 和 admin app。

```text
apps/api/src/<resource>/
  dto/
    <resource>.request.ts
    <resource>.response.ts
  <resource>.mapper.ts
  <resource>.service.ts
  <resource>.controller.ts
  <resource>.module.ts

apps/admin/src/features/<resource>/
  <resource>.types.ts
  <resource>.columns.tsx
  <Resource>Form.tsx
  <Resource>Page.tsx
  <Resource>Page.test.tsx
```

## 列表契约

标准列表端点使用服务端分页并返回：

```ts
interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
```

列表查询规则：

- `page` 在 API 边界是从 1 开始。
- 省略 `page` 时默认是 `1`。
- 省略 `pageSize` 时默认是 `20`。
- `pageSize` 必须在 `1` 到 `100` 之间。
- 无效查询值返回 `400`；不要静默夹取到合法范围。
- `search` 是可选的，并且只映射到资源批准的字段。
- `sort` 使用 `field:direction`，例如 `createdAt:desc`。
- 排序方向只能是 `asc` 和 `desc`。
- 每个资源都必须定义排序 allowlist。
- 筛选器是资源特定的，且必须显式校验。

前端表格分页通常在内部从 0 开始。在生成 API 调用边界转换为从 1 开始的 API 契约。

## 实现顺序

1. 如有需要，添加持久化变更。
2. 添加后端 DTO、mapper、service、controller 和 module wiring。
3. 添加权限注册表条目和控制器守卫。
4. 添加显式 Swagger operation ids。
5. 重新生成 API 产物。
6. 使用生成的 helper 构建管理页面。
7. 添加 route/menu metadata 和 i18n messages。
8. 添加聚焦测试。
9. 运行质量门禁。

## 后端模式

请求 DTO 应包括：

- 继承共享列表查询 DTO 的 `<Resource>ListQueryDto`。
- Create DTO。
- Update DTO。
- 资源特定筛选器校验。
- 根据资源 allowlist 进行排序校验。

响应 DTO 应包括：

- 用于公开记录字段的 `<Resource>ResponseDto`。
- 用于 `{ items, total, page, pageSize }` 的 `<Resource>ListResponseDto`。

Mapper 规则：

- 将数据库记录转换为公开响应对象。
- 将 `Date` 值转换为 ISO 字符串。
- 排除密码、令牌、密钥和私有元数据。
- 不要直接从控制器返回原始 Prisma 记录。

Service 规则：

- 为 `findMany` 和 `count` 构建一个共享的 `where` 对象。
- 应用 `skip = (page - 1) * pageSize`。
- 应用 `take = pageSize`。
- 在传给 Prisma 前解析并校验排序。
- 将唯一性冲突映射为 conflict errors。
- 将缺失记录映射为 not-found errors。
- 可用时使用共享列表响应 helper。

Controller 规则：

- 标准 CRUD 路由是 `GET /<resources>`、`GET /<resources>/:id`、`POST /<resources>`、`PATCH /<resources>/:id` 和 `DELETE /<resources>/:id`。
- 将字面量路由放在参数路由之前。
- 对 admin-only methods 使用方法级 `@Permissions()`。
- 成功删除时使用 `@HttpCode(204)`。
- 添加显式 Swagger operation ids 和 response decorators。

## 前端模式

功能文件应使用生成的 schema types、endpoint functions、hooks 和 query key helpers。为 UI-only form state、selected rows、derived values，或能让页面代码更易读的 aliases 保留本地类型。

Columns 应当：

- 由 `create<Resource>Columns(...)` 函数创建；
- 从页面接收 labels 和 action callbacks；
- 除非后端支持对应排序字段，否则保持 synthetic columns 不可排序；
- 使用与后端 sort allowlist 字段匹配的 sortable column ids。

Forms 应当：

- 使用现有表单和校验模式；
- 保持 create 和 update payloads 与生成的 DTO types 一致；
- 当字段不可编辑时，从 edit payloads 中省略这些字段；
- 为可见文案使用 i18n labels。

Pages 应当：

- 直接使用生成的 API helpers；
- 除非明确需要 URL sync，否则将列表状态保持在本地；
- mutation 后使用生成的 query key helpers 进行 invalidation；
- 展示 loading、empty、success 和 error states；
- 复用共享 table、toolbar、pagination、form、toast 和 error patterns。

## 路由、菜单、I18n 与权限

通过现有管理端 shell 使用的同一套元数据接入资源：

- 将 route/menu entry 添加到 `apps/admin/src/routes/admin-route-registry.tsx`。
- 将 `requiredPermissions` 设置为读取权限，例如 `article.read`。
- 让菜单可见性来自 route metadata。
- 确保没有权限时直接访问 URL 会解析到 `/403`。
- 为导航、页面标签、表单标签、校验文案和操作添加 i18n messages。
- 使用与后端守卫相同的权限代码保护 create、update、delete 和 special action buttons。

不要添加角色名称检查或单独的菜单授权逻辑。

## 测试清单

后端测试应覆盖：

- 列表默认值和查询校验；
- 无效 page、pageSize、sort field 和 sort direction 行为；
- search 和 filter 的 `where` 映射；
- `findMany` 和 `count` 使用相同的 `where`；
- create、update、delete、duplicate 和 not-found 行为；
- mapper 输出排除敏感字段；
- 受保护操作的权限元数据或 guarded route 行为。

前端测试应覆盖：

- loading 和 empty states；
- 代表性表格行；
- 支持时的 search、filters、sorting 和 pagination；
- create、edit、delete 和 special actions；
- permission-aware route/menu/action visibility；
- 页面负责的 API error display 和 retry behavior；
- mutation 后的 cache invalidation 或 refetch behavior。

不要测试生成 API 的实现内部。页面测试中 mock 生成的 endpoint modules 或共享 request boundary。

## 资源输入清单

实现新资源前确认这些细节：

```text
Resource name:
Route path:
Prisma model:
Public list/detail fields:
Create fields:
Update fields:
Search fields:
Sort fields:
Default sort:
Filters:
Sensitive fields that must never be returned:
Special rules:
Route/menu metadata:
Permission codes:
OpenAPI tag:
Operation ids:
```
