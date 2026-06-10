# Admin Theme Switch Design

## Goal

Add a frontend light/dark theme switch to the admin app so users can choose a comfortable visual mode across login and authenticated screens, with the choice persisting across reloads.

## Scope

- Frontend only: `apps/admin`.
- Themes: `light` and `dark`.
- Persistence: browser `localStorage`.
- Theme applies to login, authenticated shell, dashboard, placeholder pages, shared data table controls, user management, and dictionary management.
- The switch appears in both login and authenticated header controls.
- Existing language switching and route/auth behavior remain unchanged.

## Approach

Use a small local React theme layer that mirrors the existing i18n architecture:

- `theme-storage.ts`: validates, resolves, and persists theme values.
- `ThemeProvider.tsx`: owns active theme state and applies it to `document.documentElement`.
- `useTheme.ts`: exposes the typed context.
- `ThemeSwitcher.tsx`: shared icon button for toggling light/dark mode.

The provider will set `data-theme="light" | "dark"` and `style.colorScheme` on the root element. CSS variables in `index.css` will define semantic tokens for surfaces, text, borders, accents, danger states, and overlays. Because the current UI already contains many Tailwind color utilities and several of those files have active uncommitted work, this feature will use a compatibility override layer for common `bg-white`, `bg-slate-*`, `text-slate-*`, `border-slate-*`, `bg-cyan-*`, and danger classes under `[data-theme='dark']`. New theme UI should use semantic CSS variable classes directly.

Provider ordering:

- Runtime: `QueryClientProvider > ThemeProvider > I18nProvider > AdminRouterProvider + ThemedToaster`.
- Tests that render `ThemeSwitcher`, `LoginView`, or `AdminShell` must wrap with both `ThemeProvider` and `I18nProvider`.
- `ThemeSwitcher` reads translated labels through the existing i18n hook; `ThemeProvider` does not depend on i18n.

## Theme Resolution

On startup:

1. Use a valid saved theme from `localStorage`.
2. Otherwise use `window.matchMedia('(prefers-color-scheme: dark)')`.
3. Fall back to `light` when browser APIs are unavailable.

All browser access is guarded with `typeof window`/`typeof document` checks and `try/catch`, matching the existing locale storage pattern. Storage-denied/private-mode cases should not prevent the app from starting. When the user toggles the theme, the app persists the new value when possible and immediately updates the root element.

## UI

`ThemeSwitcher` is an icon-only button using `lucide-react`:

- Shows `Moon` when the current theme is light because activating it switches to dark.
- Shows `Sun` when the current theme is dark because activating it switches to light.
- Uses localized accessible labels from the existing i18n dictionary:
  - `theme.switchToDark`: button name in light mode.
  - `theme.switchToLight`: button name in dark mode.
- Uses stable `h-9 w-9` dimensions so it does not shift nearby header controls.

Placement:

- Login page: the existing top control row becomes `flex justify-end gap-2`; `ThemeSwitcher` sits before `LanguageSwitcher` on all viewport widths.
- Authenticated shell: in the top header beside `LanguageSwitcher` and before sign out.

## Styling

Add global theme tokens in `apps/admin/src/index.css`:

- `--color-app`
- `--color-surface`
- `--color-surface-muted`
- `--color-surface-hover`
- `--color-surface-elevated`
- `--color-border`
- `--color-border-strong`
- `--color-text`
- `--color-text-muted`
- `--color-text-subtle`
- `--color-accent`
- `--color-accent-hover`
- `--color-accent-foreground`
- `--color-danger`
- `--color-danger-muted`
- `--color-overlay`

Light tokens retain the current crisp slate/cyan admin look. Dark tokens use neutral dark surfaces, elevated panels, readable muted text, and the same cyan accent family. `body` uses the theme background and text tokens.

Must-cover current surfaces:

- Login page panel, fields, action button, and control row.
- Authenticated shell background, sidebar, mobile nav, header, nav items, sign-out button.
- Shared data table, toolbar, pagination.
- Dashboard and placeholder page cards.
- Current users and dictionaries list/form/modal surfaces through the compatibility override layer.
- `sonner` toasts through a themed wrapper around `<Toaster />`.

## File Boundaries

- `apps/admin/src/theme/theme-storage.ts`: theme type guard, startup resolution, persistence.
- `apps/admin/src/theme/theme-context.ts`: React context shape.
- `apps/admin/src/theme/ThemeProvider.tsx`: context provider and root DOM application.
- `apps/admin/src/theme/useTheme.ts`: typed hook.
- `apps/admin/src/theme/ThemeSwitcher.tsx`: reusable toggle button.
- `apps/admin/src/index.css`: semantic theme tokens.
- `apps/admin/src/App.tsx`: wraps existing app content in `ThemeProvider` and renders a toaster that follows the active theme.
- Existing UI files use the compatibility layer plus targeted component edits for switch placement.
- `apps/admin/src/i18n/messages.ts`: adds accessible labels for the theme switcher.

## Testing

Use Vitest and React Testing Library.

- Unit-test theme resolution and persistence.
- Component-test that `ThemeProvider` applies `data-theme` and `color-scheme`.
- Component-test that `ThemeSwitcher` toggles the theme, updates the root element, and persists the value.
- Component-test that the button name changes after toggle.
- Component-test that login and shell render the theme switch control.
- Component-test representative themed surfaces by asserting theme control placement and root theme state in login and shell. Use manual/browser smoke checks for visual color regressions because jsdom does not compute Tailwind color output reliably.
- Tests must reset `document.documentElement.dataset.theme`, `document.documentElement.style.colorScheme`, `localStorage`, and mocked `matchMedia` between cases.
- Run the full admin test suite, build, and lint after implementation.

## Risks

- Existing files have active uncommitted work, especially dictionary-related files and `DataTable.tsx`. Edits must be scoped and preserve user changes.
- Tailwind v4 arbitrary CSS variable classes must be used consistently; typoed variables only fail visually, so component coverage should assert root theme state and accessible controls.
- Dark theme readability can regress in dense tables and dialogs if a hard-coded light surface remains. The migration should include shared table components and current CRUD forms/modals.

## Non-Goals

- System/auto theme as a selectable third mode.
- Server-side theme preference storage.
- Per-user profile settings API.
- A broad visual redesign or layout refactor.
- Replacing Tailwind or introducing a UI theme dependency.
