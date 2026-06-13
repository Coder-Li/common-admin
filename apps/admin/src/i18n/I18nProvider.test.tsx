// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOCALE_STORAGE_KEY } from './locale-storage'
import { I18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

function Probe() {
  const { setLocale, t } = useI18n()

  return (
    <div>
      <span>{t('auth.signIn')}</span>
      <button type="button" onClick={() => setLocale('zh-CN')}>
        Set Chinese
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['zh-CN'],
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.removeItem(LOCALE_STORAGE_KEY)
  })

  it('uses a backend default locale before Chinese browser language', () => {
    render(
      <I18nProvider defaultLocale="en-US">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('adopts a backend default locale that arrives after initial render', async () => {
    const { rerender } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText('登录')).toBeInTheDocument()

    rerender(
      <I18nProvider defaultLocale="en-US">
        <Probe />
      </I18nProvider>,
    )

    expect(await screen.findByText('Sign in')).toBeInTheDocument()
  })

  it('does not overwrite a locale changed by the user in this session', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <I18nProvider defaultLocale="en-US">
        <Probe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set Chinese' }))

    rerender(
      <I18nProvider defaultLocale="en-US">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText('登录')).toBeInTheDocument()
  })
})
