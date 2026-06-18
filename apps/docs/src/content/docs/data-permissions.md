---
title: Data Permissions
description: User visibility and department-scoped data access rules.
draft: false
---

Common Admin's data-permission foundation controls which users an actor can see
or assign through department-scoped visibility rules.

This is not a separate public CRUD resource in the starter. It is a service
boundary used by user and organization workflows.

## Current Boundary

The data-permission service resolves the current user's permission context and
builds Prisma visibility conditions for user records.

Supported visibility concepts include:

- all users;
- self visibility;
- department-scoped visibility;
- no visible users when no allowed scope exists.

The service also checks whether an actor can assign target departments when
creating or updating users.

## When To Use

Use data-permission checks when an admin action should be limited by the
actor's allowed organization scope, for example:

- listing users;
- reading user detail;
- updating a user;
- assigning departments to a user;
- future resources that need department-based visibility.

Do not rely on frontend filters as the security boundary. Backend services must
apply visibility conditions before returning data or accepting mutations.

## Relationship To RBAC

RBAC answers: "May this user perform this action?"

Data permissions answer: "Which records may this user act on?"

Both can apply to the same endpoint. For example, a user may have `user.update`
but still be blocked from updating a target user outside their data scope.

## Implementation Rules

When extending data-permission behavior:

- keep permission context resolution centralized;
- build one visibility condition shared by list and count queries;
- return `404` for records outside visibility when the caller should not learn
  whether the record exists;
- validate department assignment against the actor's allowed department scope;
- test empty-scope behavior;
- avoid leaking hidden records through option endpoints, exports, or counts.

## Frontend Rules

Frontend pages may show filters or selectors based on available options, but
they should not duplicate backend visibility logic.

Use generated API helpers and display normal empty, forbidden, or not-found
states based on backend responses.

## Verification

Focused checks:

```bash
pnpm --filter api test -- data-permission
pnpm --filter api test -- user
```

When visibility affects HTTP behavior:

```bash
pnpm --filter api test:e2e
pnpm build
```
