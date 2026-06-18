---
title: Organization Structure
description: Department and position management patterns for admin organization data.
draft: false
---

Common Admin includes organization structure foundations through departments and
positions. These modules are normal API-backed admin resources with additional
tree and option-list behavior for user assignment and data-permission workflows.

## Modules

Backend modules:

```text
apps/api/src/department/
apps/api/src/position/
```

Admin features:

```text
apps/admin/src/features/departments/
apps/admin/src/features/positions/
```

## Permission Codes

Departments:

```text
department.read
department.create
department.update
department.delete
```

Positions:

```text
position.read
position.create
position.update
position.delete
```

The read permission protects list, detail, tree, and option endpoints. Mutations
use create, update, and delete permissions.

## Department Shape

Department APIs include list/detail CRUD plus tree and options endpoints.

Use departments when:

- assigning users to an organization unit;
- building hierarchical admin navigation or selectors;
- resolving data-permission visibility;
- organizing positions or other future business resources.

When changing hierarchy behavior, test parent/child validation, delete rules,
sort behavior, and option output. Avoid creating cycles or leaving children with
invalid parents.

## Position Shape

Position APIs include list/detail CRUD plus options for forms and selectors.

Use positions for job titles, staff categories, or product-specific organization
labels. Keep position fields public and stable enough for admin forms and table
views.

## Frontend Pattern

The admin pages should use generated API hooks, endpoint functions, schema
types, and query keys. UI-only state can stay in feature-local files.

Route metadata should use:

```text
/departments -> department.read
/positions   -> position.read
```

Action buttons should use the matching create, update, and delete codes.

## Audit And Data Permissions

Department and position changes can affect user visibility, role assignment
context, and data-permission rules. Mutations should preserve audit metadata and
request id correlation.

If a department change could affect data visibility, test the data-permission
behavior that depends on it.

## Verification

Focused checks:

```bash
pnpm --filter api test -- department
pnpm --filter api test -- position
pnpm --filter admin test -- DepartmentsPage
pnpm --filter admin test -- PositionsPage
```

For API contract changes:

```bash
pnpm api:check
pnpm build
```
