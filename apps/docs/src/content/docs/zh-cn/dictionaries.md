---
title: 字典
description: 字典类型和字典项管理、公开选项端点、缓存刷新，以及生成的 API 用法。
draft: false
---

字典为产品功能提供由管理端维护的选项列表。字典类型对字典项进行分组，字典项的值通过选项端点暴露给表单和筛选器。

## 模块

后端模块：

```text
apps/api/src/dictionary/
```

管理端功能：

```text
apps/admin/src/features/dictionaries/
```

## 权限代码

字典管理使用：

```text
dictionary.read
dictionary.create
dictionary.update
dictionary.delete
```

公开选项端点是已认证的 API 端点，但在 starter 中不受字典管理权限装饰器保护。管理页面和变更操作仍然受权限保护。

## 资源形态

字典类型：

- 通过代码标识一组选项；
- 为管理员提供标签和描述；
- 拥有字典项。

字典项：

- 属于某个类型；
- 提供标签和值；
- 根据模块 DTO 和服务规则支持排序/状态行为。

一旦其他功能依赖类型代码和字典项值，就应保持它们稳定。修改它们可能破坏筛选器、表单、已保存记录或下游产品逻辑。

## 选项端点

选项端点为 UI 控件提供生成的 API 访问：

```text
GET /dictionaries/options
GET /dictionaries/{typeCode}/options
```

这些端点应只返回安全的选项数据。不要暴露内部元数据、已删除项或类似密钥的值。

诸如 `/dictionaries/options` 的字面量路由必须位于诸如 `/dictionaries/:typeCode/options` 的参数化路由之前。

## 缓存刷新

settings 模块包含字典缓存刷新操作。将缓存刷新视为管理操作：

- 使用 settings update permission 保护它；
- 记录审计元数据；
- 保留请求 id 关联；
- 在使用缓存的位置测试过期和刷新后的行为。

## 前端模式

类型、字典项和选项调用都使用生成的 API helper。为仅用于 UI 的状态和表单保留本地功能类型。

当产品功能需要选项时，优先使用生成的选项端点，而不是硬编码本地数组，除非这些值确实是静态产品常量。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- dictionary
pnpm --filter admin test -- DictionariesPage
```

对于契约或缓存行为变更：

```bash
pnpm api:check
pnpm build
```
