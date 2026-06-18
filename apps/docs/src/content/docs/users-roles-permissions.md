---
title: Users Roles And Permissions
description: User, role, permission, and session-management boundaries in Common Admin.
draft: false
---

Common Admin separates identity, role assignment, permission definitions, and
active sessions.

Use this page when changing users, roles, permission registry behavior,
permission assignment, or session management.

## Modules

Backend modules:

```text
apps/api/src/user/
apps/api/src/role/
apps/api/src/permission/
apps/api/src/user-session/
apps/api/src/auth/
apps/api/src/data-permission/
```

Admin features:

```text
apps/admin/src/features/users/
apps/admin/src/features/roles/
apps/admin/src/features/permissions/
apps/admin/src/features/session-management/
```

## Permission Codes

User management:

```text
user.read
user.create
user.update
user.delete
user.assign_roles
```

Role management:

```text
role.read
role.create
role.update
role.delete
role.assign_permissions
```

Permission catalog:

```text
permission.read
```

Session management:

```text
user_session.read
user_session.revoke
```

Do not replace these with role-name checks. Keep backend guards, route metadata,
menu visibility, page actions, registry entries, seed behavior, and tests
aligned.

## User Workflow

User changes normally affect:

- request DTOs and response DTOs;
- mapper output that must never expose password hashes;
- service validation and uniqueness rules;
- role assignment rules;
- data-permission visibility rules;
- audit logs for sensitive changes;
- generated frontend API usage;
- route and page action gates.

Password reset and role replacement are sensitive operations. They should remain
guarded, audited, and tested separately from normal profile updates.

## Role Workflow

Roles define bundles of permission codes. Role changes normally affect:

- role CRUD behavior;
- protected system role behavior;
- permission replacement semantics;
- seed/upsert expectations;
- frontend role forms and permission panels.

`role.assign_permissions` is separate from `role.update` because changing a
role's permissions is a higher-impact operation than editing labels or
descriptions.

## Permission Registry

The permission registry is the source for stable permission definitions. Each
entry should include:

- stable code;
- module;
- action;
- display name and description;
- default roles;
- sort order.

Seed behavior should add new permissions and assign defaults without silently
undoing administrator changes. Removing or renaming permission codes is a data
migration concern.

## Session Management

Session management is separate from auth login/logout. It lets authorized admins
list user sessions and revoke sessions through protected API endpoints.

Revocation should:

- avoid revoking the current session when that behavior is prohibited by the
  service;
- record audit metadata;
- preserve request id correlation;
- use generated API helpers in the admin page.

## Verification

Focused checks:

```bash
pnpm --filter api test -- user
pnpm --filter api test -- role
pnpm --filter api test -- permission
pnpm --filter api test -- user-session
pnpm --filter admin test -- UsersPage
pnpm --filter admin test -- RolesPage
pnpm --filter admin test -- PermissionsPage
```

For contract, auth, permission, or session behavior changes:

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
