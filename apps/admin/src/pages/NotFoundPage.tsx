import { SearchX } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import { PlaceholderPage } from './PlaceholderPage'

export function NotFoundPage() {
  const { t } = useI18n()

  return (
    <PlaceholderPage
      icon={<SearchX size={20} />}
      title={t('page.notFoundTitle')}
      description={t('page.notFoundDescription')}
    />
  )
}
