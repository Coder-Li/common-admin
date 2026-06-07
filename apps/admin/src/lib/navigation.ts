export function navigateTo(path: string, mode: 'push' | 'replace' = 'push') {
  if (mode === 'replace') {
    window.history.replaceState({}, '', path)
  } else {
    window.history.pushState({}, '', path)
  }

  window.dispatchEvent(new PopStateEvent('popstate'))
}

