# System Settings Design

## Goal

Turn the current settings placeholder into a real system settings area for
Common Admin.

The first version should provide a practical, reusable template-level settings
module without becoming a general-purpose secret or integration configuration
center. It should expose a top-level "System Settings" menu with focused child
routes for basic app settings, upload policy, cache maintenance, and read-only
system information.

The target state is:

- Administrators can update site name, site subtitle, default locale, and
  default theme.
- Administrators can tighten upload limits and allowed MIME types within the
  bounds configured by environment variables.
- Administrators can refresh dictionary cache from a stable maintenance page.
- Administrators can inspect safe runtime system information without exposing
  secrets.
- Settings are stored in the database through strongly typed backend settings
  definitions instead of an unconstrained frontend key/value editor.
- Settings changes and maintenance actions are permission-gated and audit
  logged.
- Frontend API access uses the generated OpenAPI/Orval contract.

## Context

The project already has most of the surrounding foundation:

- `setting.read` and `setting.update` are present in the backend permission
  registry.
- The admin route registry has a `/settings` placeholder route inside the
  `configuration` menu group.
- The frontend uses TanStack Router, grouped route metadata, permission-aware
  menu filtering, React Query, i18n, and a local theme provider.
- API contract generation is in place through Swagger metadata,
  `apps/api/openapi.json`, and Orval-generated admin endpoints.
- Upload constraints currently come from API environment variables:
  `FILE_MAX_SIZE_MB` and `FILE_ALLOWED_MIME_TYPES`.
- File upload, dictionary management, audit logs, normalized errors, and
  request logging already exist as separate features.

The settings module should connect these existing pieces instead of replacing
them. In particular, environment variables remain the source of deployment and
security boundaries. Database-backed settings may narrow those boundaries at
runtime, but they must not silently widen them.

## Chosen Approach

Use a strongly typed settings module backed by a small database key/value table.

The database stores durable setting values. The backend settings module owns the
catalog of valid keys, groups, default values, validation rules, DTO mapping,
and environment-bound constraints. The admin app never edits arbitrary setting
keys directly.

First-version settings are grouped by page:

```text
basic.siteName
basic.siteSubtitle
basic.defaultLocale
basic.defaultTheme
upload.maxSizeMb
upload.allowedMimeTypes
```

The admin app exposes four child routes:

```text
/settings/basic
/settings/upload
/settings/cache
/settings/system-info
```

`/settings` should redirect to `/settings/basic` unless the router
implementation already has a more natural route index convention.

Principles:

- Keep the first version useful but small.
- Treat deployment-level configuration as read-only or hidden.
- Store only non-secret settings in this module.
- Prefer typed DTOs over leaking raw setting records to the frontend.
- Make future integration settings possible without designing that feature now.
- Preserve the current route metadata, permission, audit log, and generated API
  patterns.

## Non-Goals

The first version should not include:

- Third-party login app ids, app secrets, client secrets, or callback settings.
- SMS, email, payment, object storage, webhook, or OAuth secret management.
- Encrypted configuration storage.
- Secret rotation, masking, write-only secret fields, or secret health checks.
- Multi-tenant or per-organization settings.
- Per-user persisted preferences in the database.
- Runtime editing of database URLs, Redis URLs, JWT secrets, cookie secrets,
  CORS origins, or other deployment/security configuration.
- Dynamic form rendering from arbitrary setting metadata.
- Full settings version history or rollback.
- Redis-backed settings cache.
- Database-driven menus.

Future sensitive integration settings should be designed as a separate feature.
That feature will need encryption, write-only or masked fields, reset flows,
configuration status, audit-log sanitization, and explicit activation rules.

## Data Model

Add a `SystemSetting` model:

```prisma
model SystemSetting {
  key       String   @id @db.VarChar(120)
  value     Json
  group     String   @db.VarChar(80)
  updatedBy String?  @db.VarChar(120)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([group])
}
```

Field rules:

- `key` is a stable fully qualified setting key such as `basic.siteName`.
- `value` stores the validated JSON value for that key.
- `group` stores the first segment of the key, such as `basic` or `upload`, so
  group reads remain simple.
- `updatedBy` stores the actor user id when available. It is supplemental to
  audit logs, not a replacement for them.
- The table should only contain keys known by the backend setting definitions.

Do not expose this table through a generic CRUD controller. All reads and
writes go through typed settings service methods.

## Setting Definitions

Create a backend settings definition module that acts as the single source of
truth for first-version settings:

```ts
type SettingDefinition<T> = {
  key: string
  group: 'basic' | 'upload'
  defaultValue: (env: AppEnv) => T
  validate: (value: unknown, context: SettingsValidationContext) => T
}
```

The exact implementation may use Zod, class-validator DTOs, or local helper
functions, but validation must stay centralized and unit tested.

First-version definitions:

| Key | Type | Default | Validation |
| --- | --- | --- | --- |
| `basic.siteName` | string | `Common Admin` | trim, 1-80 characters |
| `basic.siteSubtitle` | string | `Starter template` | trim, 0-160 characters |
| `basic.defaultLocale` | enum | `zh-CN` | `zh-CN` or `en-US` |
| `basic.defaultTheme` | enum | `light` | `light` or `dark` |
| `upload.maxSizeMb` | integer | `FILE_MAX_SIZE_MB` | positive, no greater than environment max |
| `upload.allowedMimeTypes` | string array | environment MIME list | non-empty subset of environment MIME list |

Upload settings must follow this invariant:

- Environment variables define the maximum allowed upload policy.
- Database settings may narrow that policy.
- Database settings may not allow a larger file size or a MIME type not present
  in the environment allow-list.

This keeps local administration useful without weakening deployment-level
safety controls.

`basic.siteSubtitle` is stored as one plain string, not as localized copy. The
default value matches the current English shell subtitle. Chinese UI can still
fall back to existing localized static copy while settings are loading or when
the settings request fails; once loaded, the configured subtitle is shown as
entered.

## Backend Modules

Add a `SettingsModule` under:

```text
apps/api/src/settings/
  dto/
    settings-basic.request.ts
    settings-basic.response.ts
    settings-upload.request.ts
    settings-upload.response.ts
    settings-cache.response.ts
    settings-system-info.response.ts
  settings.constants.ts
  settings.definitions.ts
  settings.mapper.ts
  settings.service.ts
  settings.controller.ts
  settings.module.ts
```

Responsibilities:

- `settings.definitions.ts` declares valid keys, defaults, and validation.
- `settings.service.ts` loads settings, merges database values with defaults,
  validates updates, writes changed values transactionally, and records audit
  logs.
- `settings.mapper.ts` maps internal values to DTOs.
- `settings.controller.ts` exposes typed endpoints and applies permissions.
- DTO files provide request validation and Swagger metadata for contract
  generation.

The service should offer typed methods rather than generic key mutation:

```ts
getBasicSettings()
updateBasicSettings(input, actor, requestMeta)
getUploadSettings()
updateUploadSettings(input, actor, requestMeta)
refreshDictionaryCache(actor, requestMeta)
getSystemInfo()
getEffectiveUploadPolicy()
```

`getEffectiveUploadPolicy()` should be the method consumed by file upload code.
It returns the database upload policy when present, constrained by environment
limits, with environment defaults as fallback.

## API Endpoints

Add these endpoints:

```text
GET   /settings/basic
PATCH /settings/basic

GET   /settings/upload
PATCH /settings/upload

POST  /settings/cache/dictionaries/refresh

GET   /settings/system-info
```

Permissions:

- All `GET` endpoints require `setting.read`.
- `PATCH` endpoints require `setting.update`.
- `POST /settings/cache/dictionaries/refresh` requires `setting.update`.

Request and response DTOs should be explicit:

```ts
type BasicSettingsResponse = {
  siteName: string
  siteSubtitle: string
  defaultLocale: 'zh-CN' | 'en-US'
  defaultTheme: 'light' | 'dark'
}

type UpdateBasicSettingsRequest = {
  siteName: string
  siteSubtitle: string
  defaultLocale: 'zh-CN' | 'en-US'
  defaultTheme: 'light' | 'dark'
}

type UploadSettingsResponse = {
  maxSizeMb: number
  allowedMimeTypes: string[]
  environmentMaxSizeMb: number
  environmentAllowedMimeTypes: string[]
  storageDriver: 'local'
}

type UpdateUploadSettingsRequest = {
  maxSizeMb: number
  allowedMimeTypes: string[]
}

type DictionaryCacheRefreshResponse = {
  refreshedAt: string
}

type SystemInfoResponse = {
  serviceName: string
  appEnv: string
  nodeEnv: string
  logLevel: string
  storageDriver: string
  uploadMaxSizeMb: number
  uploadAllowedMimeTypes: string[]
}
```

The final DTO class names can follow existing project conventions, but the
runtime shape should stay typed and page-oriented.

## System Information Safety

`GET /settings/system-info` must be an allow-list, not a dump of the validated
environment object.

Safe fields for the first version:

- `SERVICE_NAME`
- `APP_ENV`
- `NODE_ENV`
- `LOG_LEVEL`
- `FILE_STORAGE_DRIVER`
- `FILE_MAX_SIZE_MB`
- `FILE_ALLOWED_MIME_TYPES`

Do not return:

- Database URLs.
- Redis URLs.
- JWT secrets.
- Refresh cookie names, domains, or security attributes.
- Allowed origins.
- Any value whose name contains `SECRET`, `TOKEN`, `PASSWORD`, `KEY`, or
  connection credentials.

This endpoint is for operator context, not secret inspection.

## Cache Maintenance

The first cache maintenance page should include dictionary cache refresh only.

Current dictionary option queries are cached on the frontend through React
Query. If the backend has no dictionary cache by the time this feature is
implemented, the backend refresh endpoint should still exist as a stable
maintenance contract:

- It validates `setting.update`.
- It records an audit log entry.
- It returns `{ refreshedAt }`.
- The frontend invalidates dictionary-related React Query keys after success.

The frontend must invalidate the generated dictionary option query families
used by `apps/admin/src/lib/dictionaries/useDictionary.ts`:

- `getGetDictionaryOptionsQueryKey(typeCode)` for single dictionary option
  queries.
- `getGetDictionaryOptionsMapQueryKey({ types })` for multi-dictionary option
  queries.

It may invalidate by exact keys when known or by a predicate that matches those
generated dictionary options key prefixes. It should not invalidate unrelated
list-management queries unless the implementation explicitly needs to refresh
the dictionary management page too.

If backend dictionary caching is later added, the same endpoint can clear Redis
or memory caches without changing the frontend page.

Do not add generic cache key deletion in the first version.

## Frontend Routes And Menu

Replace the single settings placeholder route with four child settings routes
in the existing route metadata model. The `configuration` menu group should be
replaced by a top-level settings menu group:

```text
settings / System Settings
  settings-basic       /settings/basic
  settings-upload      /settings/upload
  settings-cache       /settings/cache
  settings-system-info /settings/system-info
```

The user-facing labels should be localized:

```text
System Settings
Basic Settings
Upload Settings
Cache Maintenance
System Information
```

The Chinese labels can be:

```text
系统设置
基础设置
上传设置
缓存维护
系统信息
```

If the current menu component only supports a group and route level, this design
does not require a deeper nested menu. Use the group itself as the top-level
"System Settings" menu, with the four routes as its children. Avoid introducing
unlimited recursive menus in this feature.

The intended route metadata shape is:

```ts
{
  id: 'settings',
  labelKey: 'nav.group.settings',
  children: [
    settingsBasicRoute,
    settingsUploadRoute,
    settingsCacheRoute,
    settingsSystemInfoRoute,
  ],
}
```

The old placeholder route id `settings` should not remain as a visible menu
child. If a hidden redirect route is needed for `/settings`, give it a distinct
id such as `settings-index` with `hideInMenu: true`.

`/settings` should redirect to `/settings/basic` or be implemented as a hidden
route that navigates to the first accessible settings child.

## Frontend Pages

Add focused pages under:

```text
apps/admin/src/features/settings/
  BasicSettingsPage.tsx
  UploadSettingsPage.tsx
  CacheSettingsPage.tsx
  SystemInfoPage.tsx
```

Shared helpers or small components are fine when they remove real duplication,
but avoid creating a generic settings form framework.

### Basic Settings Page

Fields:

- Site name.
- Site subtitle.
- Default locale.
- Default theme.

Behavior:

- Loads from `GET /settings/basic`.
- Saves through `PATCH /settings/basic`.
- Shows validation errors and normalized API errors through existing toast/error
  patterns.
- Disables or hides save controls when the user lacks `setting.update`.
- Uses generated API hooks/functions from Orval.

The site name and subtitle should be available to shell/login branding after
the settings API is integrated. If settings fail to load, the app should fall
back to current static copy.

Default locale and default theme only affect users or browsers that have not
already made a local preference choice. Existing local preference should win.

### Upload Settings Page

Fields:

- Max upload size in MB.
- Allowed MIME types.

Behavior:

- Loads from `GET /settings/upload`.
- Saves through `PATCH /settings/upload`.
- Displays environment constraints from the response.
- Prevents selecting MIME types outside the environment allow-list.
- Prevents a max size above the environment max.
- Explains invalid input through field errors, not only a toast.
- Disables or hides save controls when the user lacks `setting.update`.

The existing file upload flow should use the effective backend policy. The
frontend upload dialog may optionally read upload settings for user guidance,
but server-side validation remains authoritative.

### Cache Maintenance Page

Controls:

- Refresh dictionary cache.

Behavior:

- Calls `POST /settings/cache/dictionaries/refresh`.
- On success, invalidates dictionary React Query keys.
- Shows success or error toast.
- Disables the action without `setting.update`.

The page should stay intentionally small. Additional cache actions can be added
when the project has concrete caches to manage.

### System Information Page

Content:

- Service name.
- App environment.
- Node environment.
- Log level.
- Storage driver.
- Environment upload max size.
- Environment allowed MIME types.

Behavior:

- Loads from `GET /settings/system-info`.
- Renders read-only fields.
- Has no edit controls.
- Does not expose secret-like values.

## Branding And Preference Resolution

The first implementation should introduce a small frontend app-settings query or
provider only if needed by multiple surfaces such as login and admin shell.

Resolution rules:

- Site name and subtitle come from backend basic settings when available.
- Static i18n copy remains the fallback while loading or if the settings request
  fails.
- Saved local locale wins over system default locale.
- Saved local theme wins over system default theme.
- If there is no saved local locale, backend `defaultLocale` wins.
- If there is no saved local theme, backend `defaultTheme` wins.
- Browser language is considered only when there is no saved locale and basic
  settings are unavailable.
- System color-scheme preference is considered only when there is no saved theme
  and basic settings are unavailable.
- If none of the above is available, locale falls back to the current static
  locale fallback and theme falls back to `light`.

Do not block the whole app shell on settings loading. Branding can update after
the query resolves.

## Audit Logging

Settings writes and cache maintenance actions must create audit records.

Required audit values for settings updates:

```text
action: system_setting.update
resourceType: system_setting
resourceId: basic | upload
before: previous typed settings
after: updated typed settings
metadata: changedKeys, requestId
```

Required audit values for dictionary cache refresh:

```text
action: system_setting.cache_refresh
resourceType: system_setting
resourceId: cache.dictionary
metadata: refreshedAt, requestId
```

The first version has no secret settings, so before/after snapshots may include
all settings values. Future sensitive integration settings must use a separate
sanitization policy.

## Error Handling

Use the existing normalized API error model.

Backend validation should produce stable validation responses for:

- Empty or too-long site name.
- Too-long site subtitle.
- Unsupported default locale.
- Unsupported default theme.
- Upload size above environment max.
- Upload size that is not a positive integer.
- Empty upload MIME list.
- Upload MIME type not allowed by the environment.

Concurrency can use last-write-wins for the first version. Do not add optimistic
locking or settings versioning until there is a real product requirement.

If a database setting record contains invalid JSON because of manual database
edits, the service must ignore that stored value for reads, fall back to the
definition default for that key, and log a runtime error with the setting key
and request id when available. It must not return the invalid raw value to the
frontend. A later valid update through the settings API can overwrite the bad
row.

## OpenAPI And Generated Client

All settings DTOs must include Swagger metadata so the generated OpenAPI file
contains the settings contract.

After backend endpoints are added:

- Regenerate `apps/api/openapi.json`.
- Regenerate admin Orval output.
- Use generated endpoint functions/hooks in settings pages.
- Avoid adding handwritten API clients for settings.

The existing API contract guide remains the pattern for this work.

## Testing

Backend tests:

- Settings definitions return expected defaults from environment config.
- `GET /settings/basic` returns defaults when no database settings exist.
- Invalid stored setting JSON falls back to the definition default and logs a
  runtime error.
- `PATCH /settings/basic` persists validated values.
- Basic settings validation rejects invalid locale, theme, empty name, and
  overlong fields.
- `GET /settings/upload` returns effective database values plus environment
  constraints.
- `PATCH /settings/upload` rejects size above environment max.
- `PATCH /settings/upload` rejects MIME types outside environment allow-list.
- File upload validation uses `getEffectiveUploadPolicy()`.
- `GET /settings/system-info` returns allow-listed fields only.
- `POST /settings/cache/dictionaries/refresh` requires `setting.update` and
  returns a timestamp.
- `setting.read` and `setting.update` permissions protect the correct endpoints.
- Settings updates and cache refresh create audit logs.
- OpenAPI generation includes settings DTOs.

Frontend tests:

- Route registry includes `/settings/basic`, `/settings/upload`,
  `/settings/cache`, and `/settings/system-info`.
- Route registry replaces the old `configuration` group with
  `nav.group.settings`.
- `/settings` redirects to `/settings/basic` or otherwise resolves to the first
  settings child.
- Users without `setting.read` do not see the settings menu routes.
- Users with `setting.read` can view pages but cannot save or refresh without
  `setting.update`.
- Users with `setting.update` can submit basic and upload settings forms.
- Upload page renders environment constraints and blocks invalid client input.
- Cache page calls the refresh endpoint, shows success, and invalidates
  dictionary query keys.
- System information page renders read-only fields and no edit controls.
- Branding fallback still works when basic settings fail to load.

Verification commands should include:

```sh
pnpm --filter api test -- settings
pnpm --filter api test -- file.service.spec.ts
pnpm --filter admin test -- src/routes/admin-route-registry.test.tsx src/routes/router.test.tsx
pnpm --filter admin test -- src/features/settings
pnpm api:check
```

The exact targeted filenames can be adjusted to the implementation files, but
the final verification should cover backend settings behavior, upload policy
integration, frontend settings routes/pages, and generated API contract
freshness.

## Rollout Notes

Seed behavior can stay simple:

- Do not seed every setting row eagerly unless it helps implementation.
- Reads should merge database values over definition defaults.
- Updating a group can upsert only the keys in that group.

Existing deployments should work after migration because the settings table
defaults are derived from current static and environment defaults.

The first implementation should remove the settings placeholder page once the
new settings routes are available.
