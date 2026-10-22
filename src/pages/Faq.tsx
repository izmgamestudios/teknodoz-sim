import { useI18n } from '../i18n'

export default function Faq() {
  const { t } = useI18n()
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t.faq.title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{t.faq.intro}</p>
      <div className="mt-6 space-y-2">
        {t.faq.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="mr-2 text-brand group-open:hidden">+</span>
              <span className="mr-2 hidden text-brand group-open:inline">−</span>
              {item.q}
            </summary>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
