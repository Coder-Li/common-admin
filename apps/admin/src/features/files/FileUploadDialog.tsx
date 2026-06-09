import { useState, type FormEvent } from 'react'
import { Upload } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { formatFileSize } from './files.columns'

interface FileUploadDialogProps {
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (formData: FormData) => void
}

export function FileUploadDialog({
  isSubmitting,
  onCancel,
  onSubmit,
}: FileUploadDialogProps) {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    if (displayName.trim()) {
      formData.append('displayName', displayName.trim())
    }

    if (description.trim()) {
      formData.append('description', description.trim())
    }

    onSubmit(formData)
  }

  return (
    <form className="grid gap-4" onSubmit={submitForm}>
      <label className="grid min-w-0 gap-1.5 text-sm">
        <span className="font-medium text-slate-700">{t('files.form.file')}</span>
        <input
          className="block w-full text-sm text-slate-700 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium file:text-slate-700"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {file ? (
          <div className="grid gap-1">
            <span className="font-medium text-slate-800">{file.name}</span>
            <span>
              {file.type || 'application/octet-stream'} /{' '}
              {formatFileSize(String(file.size))}
            </span>
          </div>
        ) : (
          t('files.form.noFile')
        )}
      </div>

      <label className="grid min-w-0 gap-1.5 text-sm">
        <span className="font-medium text-slate-700">
          {t('files.form.displayName')}
        </span>
        <input
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
          maxLength={255}
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
      </label>

      <label className="grid min-w-0 gap-1.5 text-sm">
        <span className="font-medium text-slate-700">
          {t('files.form.description')}
        </span>
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
          maxLength={500}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          {t('files.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!file || isSubmitting}
          type="submit"
        >
          <Upload size={16} />
          {t('files.action.upload')}
        </button>
      </div>
    </form>
  )
}
