import { useSyncExternalStore } from 'react'

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange)
  return () => window.removeEventListener('popstate', onStoreChange)
}

function getPath() {
  return window.location.pathname
}

export function useLocationPath() {
  return useSyncExternalStore(subscribeToLocation, getPath, () => '/')
}

