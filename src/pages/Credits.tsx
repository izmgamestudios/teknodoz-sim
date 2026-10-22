import { CREDITS } from '../config'

const links = [
  { label: 'E-posta', value: CREDITS.email, href: `mailto:${CREDITS.email}` },
  { label: 'WhatsApp', value: 'wa.me/905417709205', href: CREDITS.whatsapp },
  {
    label: 'LinkedIn',
    value: 'linkedin.com/in/huseyin-bayer-izmgamestudios',
    href: CREDITS.linkedin,
  },
]

export default function Credits() {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-bold">Credits</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {CREDITS.studio} tarafından geliştirilmektedir. Beta erken erişim
        sürecinde geri bildirimlerin için bize ulaş.
      </p>
      <ul className="mt-6 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 transition-colors hover:border-brand"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {l.label}
              </div>
              <div className="mt-1 break-all text-sm text-slate-900 dark:text-slate-100">{l.value}</div>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-slate-500">
        Simülasyon altyapısı:{' '}
        <a
          className="underline"
          href="https://github.com/MatrAIx-ai/MatrAIx-Persona-8B"
          target="_blank"
          rel="noopener noreferrer"
        >
          MatrAIx
        </a>{' '}
        (MIT).
      </p>
    </section>
  )
}
