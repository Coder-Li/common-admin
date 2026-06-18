---
title: Dictionaries
description: Dictionary type and item management, public option endpoints, cache refresh, and generated API usage.
draft: false
---

Dictionaries provide admin-managed option lists for product features. A
dictionary type groups dictionary items, and item values are exposed through
option endpoints for forms and filters.

## Modules

Backend module:

```text
apps/api/src/dictionary/
```

Admin feature:

```text
apps/admin/src/features/dictionaries/
```

## Permission Codes

Dictionary management uses:

```text
dictionary.read
dictionary.create
dictionary.update
dictionary.delete
```

The public option endpoints are authenticated API endpoints but are not guarded
by dictionary-management permission decorators in the starter. Management pages
and mutations remain permission-protected.

## Resource Shape

Dictionary types:

- identify a group of options by code;
- provide labels and descriptions for admins;
- own dictionary items.

Dictionary items:

- belong to a type;
- provide labels and values;
- support sort/status behavior according to the module DTOs and service rules.

Keep type codes and item values stable once other features depend on them.
Changing them can break filters, forms, saved records, or downstream product
logic.

## Option Endpoints

Option endpoints provide generated API access for UI controls:

```text
GET /dictionaries/options
GET /dictionaries/{typeCode}/options
```

These endpoints should return safe option data only. Do not expose internal
metadata, deleted items, or secret-like values.

Literal routes such as `/dictionaries/options` must stay before parameterized
routes such as `/dictionaries/:typeCode/options`.

## Cache Refresh

The settings module includes a dictionary cache refresh action. Treat cache
refresh as an admin operation:

- guard it with settings update permission;
- record audit metadata;
- preserve request id correlation;
- test stale and refreshed behavior where the cache is used.

## Frontend Pattern

Use generated API helpers for type, item, and option calls. Keep local feature
types for UI-only state and forms.

When a product feature needs options, prefer the generated option endpoints
instead of hard-coded local arrays unless the values are truly static product
constants.

## Verification

Focused checks:

```bash
pnpm --filter api test -- dictionary
pnpm --filter admin test -- DictionariesPage
```

For contract or cache behavior changes:

```bash
pnpm api:check
pnpm build
```
