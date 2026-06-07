# Admin I18n Design

## Goal

Add lightweight internationalization to the admin frontend so the current UI supports Simplified Chinese and English copy before the product surface grows.

## Scope

- Frontend only: `apps/admin`.
- Languages: `zh-CN` and `en-US`.
- Copy migration: login view, admin shell navigation/header, dashboard content, placeholder pages, and auth toasts.
- Brand name `Common Admin` remains untranslated.
- API errors stay as generic localized UI messages for now; server-provided error localization is out of scope.

## Approach

Use a small local React i18n layer instead of adding a full i18n dependency. The app will get a typed message dictionary, a locale provider, and a `useI18n()` hook that exposes:

- `locale`: the active locale.
- `setLocale(locale)`: switches language immediately and persists the choice.
- `t(key, params?)`: resolves copy by key and interpolates simple named parameters.

This keeps the implementation small while preserving a clear replacement point if the app later needs pluralization, namespaces, async loading, or translation tooling.

## Locale Resolution

On startup:

1. Use a valid saved locale from `localStorage`.
2. Otherwise, inspect `navigator.languages` and `navigator.language`.
3. Use `zh-CN` when the browser language starts with `zh`; otherwise use `en-US`.

When the user switches language, store the chosen locale in `localStorage` and re-render the app immediately.

## UI

Add a compact language switcher with `中文` and `EN` options:

- Login page: near the top of the login card.
- Authenticated shell: in the top header next to sign out.

The switcher uses the same component in both places and exposes an accessible label from the dictionary.

## File Boundaries

- `apps/admin/src/i18n/messages.ts`: locale type, dictionary keys, and message dictionaries.
- `apps/admin/src/i18n/locale-storage.ts`: localStorage/browser-language resolution helpers.
- `apps/admin/src/i18n/I18nProvider.tsx`: React context, hook, interpolation, persistence.
- `apps/admin/src/i18n/LanguageSwitcher.tsx`: shared language switcher UI.
- Existing view files call `useI18n()` and remove user-facing hard-coded English strings.

## Testing

Use Vitest and React Testing Library.

- Unit-test locale resolution and persistence.
- Component-test that the login view renders default English copy, switches to Chinese, and persists the choice.
- Component-test authenticated shell copy for both languages where practical.
- Existing route, auth store, and API client tests should remain unchanged.

## Risks

- Longer Chinese copy can affect compact buttons. The switcher and sign-out area should allow wrapping or use stable sizing so header content does not overlap.
- Missing translation keys should fail at TypeScript compile time by deriving keys from the English dictionary shape.
- Tests touching `localStorage` and `navigator.language` must reset globals between cases.

## Non-Goals

- URL-based locale routing.
- Server-side locale negotiation.
- Runtime-loaded translation bundles.
- ICU pluralization or date/number formatting.

## Repository Note

The workspace at `/Users/oouoo/Documents/codes/common-admin` is not currently inside a git repository, so the required spec commit cannot be performed in this environment.
