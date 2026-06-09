import { Settings } from 'lucide-react'
import { PlaceholderPage } from './PlaceholderPage'

export function SettingsPlaceholderPage() {
  return (
    <PlaceholderPage
      icon={<Settings size={20} />}
      title="Settings"
      description="Application preferences and account settings will live here."
    />
  )
}
