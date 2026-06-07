export function PlaceholderPage({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 grid size-10 place-items-center rounded-md bg-slate-100 text-slate-700">
          {icon}
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </section>
    </div>
  )
}
