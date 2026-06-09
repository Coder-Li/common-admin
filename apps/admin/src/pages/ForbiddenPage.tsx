import { ShieldAlert } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import { PlaceholderPage } from './PlaceholderPage'

export function ForbiddenPage() {
  const { t } = useI18n()

  return (
    <PlaceholderPage
      icon={<ShieldAlert size={20} />}
      title={t('page.forbiddenTitle')}
      description={t('page.forbiddenDescription')}
    />
  )
}
