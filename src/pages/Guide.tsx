import { useState } from 'react'
import { useAuth } from '../auth'
import type { PageId } from '../config'
import { EXAMPLES, type Example } from '../examples'
import { useI18n } from '../i18n'
import { countryName, useCountryPool } from '../personas'
import { useSelection } from '../selection'
import { useStudyDraft } from '../studyDraft'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const SHOTS = ['01-login', '02-dashboard', '03-personas', '04-bulk', '05-detail', '06-study-source', '07-study-questions', '08-run']

function Shot({ name, alt }: { name: string; alt: string }) {
  const { lang } = useI18n()
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <img
      src={`/guide/${lang}/${name}.jpg`}
      alt={alt}
      loading="lazy"
      onError={() => setHidden(true)}
      className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700"
    />
  )
}

export default function Guide({ go }: { go: (p: PageId) => void }) {
  const { t, lang } = useI18n()
  const { admin } = useAuth()
  const { data: pool } = useCountryPool()
  const selection = useSelection()
  const { setDraft } = useStudyDraft()
  const [loaded, setLoaded] = useState<{ id: string; msg: string } | null>(null)

  const loadExample = (ex: Example) => {
    setDraft({
      src: ex.src,
      title: t.guide.ex[ex.id].title,
      brief: t.seed.examples[ex.id].brief,
      questions: t.seed.examples[ex.id].questions.map((q) => ({ ...q, options: [...q.options] })),
    })
    let msg = t.guide.loaded
    if (ex.audience && pool) {
      const ids: string[] = []
      for (const iso of ex.audience.countries) {
        const mine = pool.personas.filter((p) => p.c === iso && p.i === 1)
        ids.push(...[...mine].sort(() => Math.random() - 0.5).slice(0, ex.audience.perCountry).map((p) => p.id))
      }
      if (ids.length) {
        selection.clear()
        selection.addMany(ids, 'country')
        msg += ' ' + t.guide.loadedCountry.replace('{n}', String(ex.audience.perCountry)) + ` (${ex.audience.countries.map((c) => countryName(c, lang)).join(', ')})`
      }
    }
    setLoaded({ id: ex.id, msg })
  }

  return (
    <section className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t.guide.title}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t.guide.intro}</p>
        <nav aria-label={t.guide.tocTitle} className="mt-4 flex flex-wrap gap-2 text-xs">
          {t.guide.steps.map((s, i) => (
            <a key={s.t} href={`#step-${i + 1}`} className="rounded-full bg-slate-200 px-3 py-1 text-slate-700 hover:bg-brand hover:text-white dark:bg-slate-800 dark:text-slate-300">
              {i + 1}. {s.t}
            </a>
          ))}
          <a href="#examples" className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-300">{t.guide.examplesTitle}</a>
        </nav>
      </div>

      <ol className="space-y-8">
        {t.guide.steps.map((s, i) => (
          <li key={s.t} id={`step-${i + 1}`} className={`${card} scroll-mt-6`}>
            <h2 className="text-lg font-semibold"><span className="mr-2 text-brand">{i + 1}.</span>{s.t}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.d}</p>
            {s.tip && <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">💡 {s.tip}</p>}
            {SHOTS[i] && <Shot name={SHOTS[i]} alt={`${t.guide.shotAlt}: ${s.t}`} />}
          </li>
        ))}
      </ol>

      <div id="examples" className="scroll-mt-6">
        <h2 className="text-xl font-bold">{t.guide.examplesTitle}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.guide.examplesIntro}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {EXAMPLES.map((ex) => {
            const text = t.guide.ex[ex.id]
            return (
              <article key={ex.id} className={card}>
                <Shot name={`ex-${ex.id}`} alt={text.title} />
                <h3 className="mt-3 font-semibold">{text.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text.summary}</p>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.guide.learnTitle}</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {text.learn.map((l) => <li key={l}>{l}</li>)}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => loadExample(ex)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                    {t.guide.load}
                  </button>
                  {loaded?.id === ex.id && (
                    <span role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
                      {loaded.msg}{' '}
                      <button type="button" onClick={() => go('study')} className="underline">{t.nav.study} →</button>
                    </span>
                  )}
                </div>
                {!admin && loaded?.id === ex.id && <p className="mt-2 text-xs text-slate-500">{t.study.loginNeeded}</p>}
              </article>
            )
          })}
        </div>
      </div>

      <div className={card}>
        <h2 className="font-semibold">{t.guide.limitsTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          {t.guide.limits.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </section>
  )
}
