---
title: RBAC
description: 后端守卫、前端路由、菜单和页面操作的权限约定。
draft: false
---

Common Admin 使用权限代码，而不是角色名称检查。

## 权限代码

使用小写 `module.action` 代码：

```text
article.read
article.create
article.update
article.delete
article.publish
```

规则：

- 除非已有模块代码存在，否则使用单数、稳定的模块名称。
- 使用 `read` 表示列表和详情访问。
- 使用 `create`、`update` 和 `delete` 表示普通 CRUD 操作。
- 对非 CRUD 操作使用具体业务动词，例如 `publish`、`approve`、`cancel`、`refund`、`import` 或 `export`。
- 保持代码稳定。重命名权限存在数据迁移风险，因为角色、路由元数据、页面门禁、测试和种子记录都可能引用它。

## 必须保持一致

同一个权限代码应保护：

- 通过 `@Permissions()` 保护的后端控制器方法。
- 前端路由访问。
- 菜单可见性。
- 页面操作，例如 create、edit、delete、import、export 或 approve。

添加模块时，在实现前定义权限代码。如果命名或默认角色行为不清楚，请停止并询问维护者，而不是猜测。

## 注册表与种子行为

将权限添加到后端注册表，并包含稳定代码、模块、操作、名称、描述、默认角色和排序顺序。

`defaultRoles` 控制初始种子分配：

```text
defaultRoles: ['admin']      ordinary admin receives the permission
defaultRoles: []             only super_admin has it until manually assigned
defaultRoles: ['standard']   standard users receive it by default
```

指南：

- 对普通管理端 CRUD 功能使用 `defaultRoles: ['admin']`。
- 对敏感或破坏性功能使用 `defaultRoles: []`。
- 仅对有意广泛开放的访问使用 `defaultRoles: ['standard']`。
- `super_admin` 不需要出现在 `defaultRoles` 中；它会自动拥有所有 active permissions。
- 种子行为应 upsert 新权限、保留现有权限，并避免重新授予管理员手动从角色中移除的权限。
- 移除注册表条目不应静默删除生产权限记录。

## 后端执行

管理端控制器方法应使用匹配的权限装饰器：

```ts
@Permissions('article.read')
@Get()
listArticles() {}

@Permissions('article.create')
@Post()
createArticle() {}

@Permissions('article.update')
@Patch(':id')
updateArticle() {}

@Permissions('article.delete')
@Delete(':id')
deleteArticle() {}
```

列表和详情端点通常共享 `<resource>.read`。特殊操作需要自己的代码。

通用能力检查属于 guards 和 decorators。对于资源特定规则，例如 ownership limits、status transitions 或 protected system records，service-level checks 仍然合适。

## 前端执行

路由和菜单可见性应来自管理端路由元数据：

```ts
{
  path: '/articles',
  labelKey: 'nav.articles',
  requiredPermissions: ['article.read'],
}
```

页面操作应使用相同的权限代码：

```ts
const canCreate = can(permissions, 'article.create')
const canUpdate = can(permissions, 'article.update')
const canDelete = can(permissions, 'article.delete')
```

如果页面使用多个权限，优先使用功能本地常量对象，而不是分散的字符串字面量。

前端权限检查改善 UX，但后端守卫才是安全边界。隐藏按钮是不够的。

## 避免

- 角色名称检查，例如 `if admin`。
- 仅前端执行权限。
- 当功能本地权限常量更清晰时，仍散落字符串字面量。
- 为路由、菜单、页面和 API 建立分离的权限系统。
- 由生成的 API wrappers 决定用户是否有权调用某个端点。

## 重命名与迁移风险

权限代码是持久数据。将 `article.publish` 重命名为 `article.approve` 不只是文本编辑；它可能影响种子权限、现有角色分配、审计预期、路由元数据、生成测试和下游项目。

当必须重命名权限时：

- 规划数据迁移；
- 同步更新注册表条目、后端装饰器、前端路由元数据、页面操作门禁、测试和文档；
- 决定旧分配是否应迁移；
- 验证 seed 不会重复或重新授予非预期访问。

## 测试清单

后端测试应覆盖：

- 模块使用的每个权限都有注册表条目；
- 新权限的 seed/upsert 行为；
- 拥有权限的用户可以访问受保护路由；
- 没有权限的用户收到 `403`；
- 未认证用户收到 `401`；
- `super_admin` 可以访问 active permissions；
- 特殊操作使用特殊权限代码。

前端测试应覆盖：

- 当用户拥有 `<resource>.read` 时，路由出现在菜单中；
- 当用户缺少 `<resource>.read` 时，路由被隐藏；
- 没有权限时直接访问路由会重定向到 `/403`；
- create、update、delete 和 special action buttons 遵循其匹配权限。
