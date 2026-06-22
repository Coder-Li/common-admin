---
title: 组织结构
description: 用于管理端组织数据的部门和岗位管理模式。
draft: false
---

Common Admin 通过部门和岗位提供组织结构基础。这些模块是普通的 API 支撑管理资源，并为用户分配和数据权限工作流提供额外的树形结构和选项列表行为。

## 模块

后端模块：

```text
apps/api/src/department/
apps/api/src/position/
```

管理端功能：

```text
apps/admin/src/features/departments/
apps/admin/src/features/positions/
```

## 权限代码

部门：

```text
department.read
department.create
department.update
department.delete
```

岗位：

```text
position.read
position.create
position.update
position.delete
```

读取权限保护列表、详情、树和选项端点。变更操作使用创建、更新和删除权限。

## 部门形态

部门 API 包含列表/详情 CRUD，以及树和选项端点。

在以下场景使用部门：

- 将用户分配到组织单元；
- 构建层级化管理导航或选择器；
- 解析数据权限可见性；
- 组织岗位或其他未来业务资源。

修改层级行为时，请测试父子校验、删除规则、排序行为和选项输出。避免创建循环，或让子级留下无效父级。

## 岗位形态

岗位 API 包含列表/详情 CRUD，以及用于表单和选择器的选项。

将岗位用于职位名称、员工类别或产品特定的组织标签。保持岗位字段足够公开和稳定，以供管理端表单和表格视图使用。

## 前端模式

管理页面应使用生成的 API hooks、endpoint functions、schema types 和 query keys。仅用于 UI 的状态可以保留在功能本地文件中。

路由元数据应使用：

```text
/departments -> department.read
/positions   -> position.read
```

操作按钮应使用匹配的 create、update 和 delete 代码。

## 审计与数据权限

部门和岗位变更可能影响用户可见性、角色分配上下文和数据权限规则。变更操作应保留审计元数据和请求 id 关联。

如果部门变更可能影响数据可见性，请测试依赖它的数据权限行为。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- department
pnpm --filter api test -- position
pnpm --filter admin test -- DepartmentsPage
pnpm --filter admin test -- PositionsPage
```

对于 API 契约变更：

```bash
pnpm api:check
pnpm build
```
