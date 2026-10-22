import { CREDITS } from '../config'
import { useI18n } from '../i18n'

export default function Credits() {
  const { t } = useI18n()
  const links = [
    { label: t.credits.email, value: CREDITS.email, href: `mailto:${CREDITS.email}` },
    { label: t.credits.whatsapp, value: 'wa.me/905417709205', href: CREDITS.whatsapp },
    { label: t.credits.linkedin, value: 'linkedin.com/in/huseyin-bayer-izmgamestudios', href: CREDITS.linkedin },
  ]
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-bold">{t.credits.title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{t.credits.text}</p>
      <ul className="mt-6 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">{l.label}</div>
              <div className="mt-1 break-all text-sm">{l.value}</div>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-slate-500">
        {t.credits.infra}{' '}
        <a className="underline" href="https://github.com/MatrAIx-ai/MatrAIx-Persona-8B" target="_blank" rel="noopener noreferrer">
          MatrAIx
        </a>{' '}
        (MIT)
      </p>
    </section>
  )
}
