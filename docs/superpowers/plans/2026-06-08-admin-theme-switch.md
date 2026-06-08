# Admin Theme Switch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent light/dark theme switching across the admin frontend.

**Architecture:** Build a local theme layer parallel to the existing i18n layer. The app stores a typed theme in `localStorage`, applies `data-theme` and `color-scheme` to the document root, and uses CSS variables plus a scoped dark compatibility layer so current Tailwind color utilities can follow the active theme without broad rewrites in files that already have uncommitted work.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS v4, lucide-react, Vitest, React Testing Library, localStorage.

---

## File Structure

- Create `apps/admin/src/theme/theme-storage.ts`: theme constants, type guard, browser preference resolution, localStorage persistence.
- Create `apps/admin/src/theme/theme-storage.test.ts`: unit tests for theme resolution and persistence.
- Create `apps/admin/src/theme/theme-context.ts`: React context type and instance.
- Create `apps/admin/src/theme/ThemeProvider.tsx`: provider state and root DOM application effect.
- Create `apps/admin/src/theme/useTheme.ts`: typed context hook.
- Create `apps/admin/src/theme/ThemeProvider.test.tsx`: provider root attribute and color-scheme tests.
- Create `apps/admin/src/theme/ThemeSwitcher.tsx`: accessible icon-only theme toggle.
- Create `apps/admin/src/theme/ThemeSwitcher.test.tsx`: toggle, persistence, and root update tests.
- Modify `apps/admin/src/index.css`: add light/dark semantic CSS variables and body background/text tokens.
- Modify `apps/admin/src/App.tsx`: wrap `I18nProvider` subtree in `ThemeProvider` and render a toaster that follows the active theme.
- Modify `apps/admin/src/i18n/messages.ts`: add theme accessible-label copy.
- Modify `apps/admin/src/i18n/LanguageSwitcher.tsx`: make existing language control compatible with both active themes without changing behavior.
- Modify `apps/admin/src/features/auth/LoginView.tsx`: add theme switcher and migrate color classes.
- Modify `apps/admin/src/features/auth/LoginView.test.tsx`: render with `ThemeProvider` and assert switcher presence.
- Modify `apps/admin/src/layouts/AdminShell.tsx`: add theme switcher and migrate shell color classes.
- Modify `apps/admin/src/layouts/AdminShell.test.tsx`: render with `ThemeProvider` and assert switcher presence.
- Modify `apps/admin/src/index.css` dark compatibility selectors for current page/shared UI color classes instead of rewriting every color utility inside files with active work:
  - login and shell color utilities
  - shared table, toolbar, pagination utilities
  - users and dictionaries page/form/modal utilities

## Chunk 1: Theme Storage

- [ ] **Step 0: Inspect working tree**

Run: `git status --short`

Expected: note existing user changes before editing. Do not revert or overwrite unrelated changes in `DataTable.tsx`, `DictionariesPage.tsx`, `DictionariesPage.test.tsx`, or `messages.ts`.

- [ ] **Step 1: Write failing storage tests**

Create `apps/admin/src/theme/theme-storage.test.ts`:

```ts
// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  getSavedTheme,
  persistTheme,
  resolveInitialTheme,
} from './theme-storage'

function mockDarkPreference(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('theme storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockDarkPreference(false)
  })

  it('uses a valid saved theme first', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('ignores invalid saved values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    mockDarkPreference(true)
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('uses system dark preference when no saved theme exists', () => {
    mockDarkPreference(true)
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('falls back to light without a saved or dark system theme', () => {
    expect(resolveInitialTheme()).toBe('light')
  })

  it('persists and reads selected themes', () => {
    persistTheme('dark')
    expect(getSavedTheme()).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm --filter admin test -- src/theme/theme-storage.test.ts`

Expected: FAIL because `theme-storage.ts` does not exist.

- [ ] **Step 3: Implement storage**

Create `apps/admin/src/theme/theme-storage.ts` with `Theme = 'light' | 'dark'`, `THEME_STORAGE_KEY = 'common-admin.theme'`, `isTheme`, `getSavedTheme`, `resolveInitialTheme`, and `persistTheme`. Guard `window`, `localStorage`, and `matchMedia` with browser checks and `try/catch`.

- [ ] **Step 4: Verify green**

Run: `pnpm --filter admin test -- src/theme/theme-storage.test.ts`

Expected: PASS.

## Chunk 2: Theme Provider And Switcher

- [ ] **Step 1: Write failing provider and switcher tests**

Create `apps/admin/src/theme/ThemeProvider.test.tsx` and `apps/admin/src/theme/ThemeSwitcher.test.tsx`.

Provider behaviors:

- default render applies `data-theme="light"` and `color-scheme: light` when no storage/system dark.
- saved dark theme applies `data-theme="dark"` and `color-scheme: dark`.

Switcher behaviors:

- light mode renders a button named `Switch to dark theme`.
- clicking toggles root to dark and stores `dark`.
- dark mode renders a button named `Switch to light theme`.

- [ ] **Step 2: Verify red**

Run:

```bash
pnpm --filter admin test -- src/theme/ThemeProvider.test.tsx src/theme/ThemeSwitcher.test.tsx
```

Expected: FAIL because provider, hook, context, and switcher do not exist.

- [ ] **Step 3: Implement provider and switcher**

Create:

- `apps/admin/src/theme/theme-context.ts`
- `apps/admin/src/theme/ThemeProvider.tsx`
- `apps/admin/src/theme/useTheme.ts`
- `apps/admin/src/theme/ThemeSwitcher.tsx`

Use `Moon` and `Sun` from `lucide-react`. `ThemeProvider` should apply the root DOM attributes in an effect and persist only when `setTheme`/`toggleTheme` changes the theme.

- [ ] **Step 4: Verify green**

Run:

```bash
pnpm --filter admin test -- src/theme/ThemeProvider.test.tsx src/theme/ThemeSwitcher.test.tsx
```

Expected: PASS.

## Chunk 3: App Integration

- [ ] **Step 1: Write failing integration assertions**

Update:

- `apps/admin/src/features/auth/LoginView.test.tsx`: wrap render helper in `ThemeProvider` and assert `screen.getByRole('button', { name: /switch to/i })` exists.
- `apps/admin/src/layouts/AdminShell.test.tsx`: wrap render helper in `ThemeProvider` and assert the same.

- [ ] **Step 2: Verify red**

Run:

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx src/layouts/AdminShell.test.tsx
```

Expected: FAIL because screens do not render a theme switcher.

- [ ] **Step 3: Integrate provider and controls**

Modify:

- `apps/admin/src/App.tsx`: wrap the existing `I18nProvider` subtree with `ThemeProvider`, and render `Toaster` through a small component that reads `useTheme()` and passes `theme={theme}`.
- `apps/admin/src/i18n/messages.ts`: add:
  - `theme.label`
  - `theme.switchToDark`
  - `theme.switchToLight`
- `apps/admin/src/i18n/LanguageSwitcher.tsx`: preserve behavior while allowing existing classes to work under the dark compatibility layer.
- `apps/admin/src/features/auth/LoginView.tsx`: import `ThemeSwitcher` and place it beside `LanguageSwitcher`.
- `apps/admin/src/layouts/AdminShell.tsx`: import `ThemeSwitcher` and place it beside `LanguageSwitcher`.

- [ ] **Step 4: Verify green**

Run:

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx src/layouts/AdminShell.test.tsx
```

Expected: PASS.

## Chunk 4: CSS Tokens And Dark Compatibility Layer

- [ ] **Step 1: Add semantic tokens**

Modify `apps/admin/src/index.css` with root variables:

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

Add `[data-theme='dark']` overrides and set `body` background/color to the app tokens.

- [ ] **Step 2: Add scoped compatibility selectors**

Add `[data-theme='dark']` selectors for common current Tailwind color utilities so existing screens follow dark mode without large overlapping edits. Preserve spacing, size, layout, state, and disabled behavior.

Examples:

- `[data-theme='dark'] .bg-white { background-color: var(--color-surface); }`
- `[data-theme='dark'] .bg-slate-100 { background-color: var(--color-app); }`
- `[data-theme='dark'] .border-slate-200 { border-color: var(--color-border); }`
- `[data-theme='dark'] .text-slate-950 { color: var(--color-text); }`
- `[data-theme='dark'] .text-slate-500 { color: var(--color-text-muted); }`
- `[data-theme='dark'] .bg-cyan-500 { background-color: var(--color-accent); }`

- [ ] **Step 3: Run targeted tests**

Add at least one integrated app-level assertion that toggling the visible theme control changes the root `data-theme`, either through existing login/shell tests or a dedicated theme integration test.

Run the color audit:

```bash
rg -n "bg-white|bg-slate-|text-slate-|border-slate-|bg-cyan-|text-white|rose-" apps/admin/src --glob '*.tsx' --glob '*.css'
```

Expected: remaining hard-coded color utilities are either covered by the dark compatibility selectors in `index.css` or intentionally unchanged for non-theme semantics.

Run:

```bash
pnpm --filter admin test -- src/theme/theme-storage.test.ts src/theme/ThemeProvider.test.tsx src/theme/ThemeSwitcher.test.tsx src/features/auth/LoginView.test.tsx src/layouts/AdminShell.test.tsx
```

Expected: PASS.

## Chunk 5: Full Verification

- [ ] **Step 1: Run full admin tests**

Run: `pnpm --filter admin test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm --filter admin lint`

Expected: PASS or only pre-existing unrelated warnings/errors. Investigate any theme-related failures.

- [ ] **Step 3: Run build**

Run: `pnpm --filter admin build`

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run: `git status --short && git diff -- apps/admin docs/superpowers`

Expected: theme docs and theme implementation only, while preserving pre-existing uncommitted changes.

- [ ] **Step 5: Visual smoke check**

Start the admin dev server and inspect `/login`, `/dashboard`, `/users`, and `/dictionaries` in both light and dark themes. Include at least one table surface and one modal/menu path when reachable without backend data. Confirm no obvious unreadable text, broken controls, or layout overlap.
