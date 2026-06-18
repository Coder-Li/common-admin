---
title: Settings
description: Runtime-editable settings, deployment-only configuration, upload policy limits, and secret handling.
draft: false
---

Common Admin separates runtime-editable product settings from deployment-only
configuration.

Use settings for product behavior that administrators may safely change from the
admin UI. Use environment variables for infrastructure, secrets, network
boundaries, and deployment policy ceilings.

## Runtime-Editable Settings

The settings module currently covers:

- basic product display settings;
- default locale and theme;
- upload policy values within deployment-defined limits;
- dictionary cache refresh actions;
- read-only system information for operators.

Settings endpoints are guarded with `setting.read` and `setting.update`.
Administrative changes should be audited.

## Deployment-Only Configuration

Keep these in environment variables or deployment configuration:

- database and Redis connection strings;
- JWT secrets;
- refresh-cookie security, same-site, and domain values;
- allowed origins;
- file storage driver and storage root;
- maximum upload policy ceiling;
- logging configuration;
- diagnostic endpoint toggles;
- demo mode.

Do not move secrets into runtime settings just to make them editable from the
admin UI.

## Upload Policy Boundary

Upload settings are runtime-editable only within the deployment ceiling.

`FILE_MAX_SIZE_MB` and `FILE_ALLOWED_MIME_TYPES` define the maximum policy that
the deployment permits. Runtime upload settings may be stricter, but they should
not exceed those environment-defined limits.

When a file is uploaded, the file service checks the effective upload policy
before storing metadata or bytes.

## Secret Handling

Settings values may appear in API responses, admin UI state, audit payloads, or
logs depending on how a feature uses them. Therefore settings must not contain:

- passwords;
- access tokens;
- refresh tokens;
- API keys;
- database URLs;
- private storage credentials;
- customer secrets.

If a future product needs editable secrets, model them as a dedicated secret
management feature with encryption, redaction, access control, and audit rules.
Do not add them to the normal settings table.

## Adding A Setting

When adding a runtime setting:

1. Define the setting key, group, default value, and validation.
2. Decide whether the value can be public in admin API responses.
3. Add DTO metadata and stable operation ids.
4. Guard reads and writes with settings permissions.
5. Audit write operations with sanitized payloads.
6. Update generated frontend API artifacts through `pnpm api:generate`.
7. Use generated hooks, functions, schema types, and query keys in the admin app.
8. Add tests for validation, defaults, persistence, audit behavior, and UI usage.

## Verification

Focused checks:

```bash
pnpm --filter api test -- settings
pnpm --filter admin test -- settings
```

For contract changes:

```bash
pnpm api:check
pnpm build
```
