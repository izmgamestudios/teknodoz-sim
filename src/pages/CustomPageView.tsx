import Markdownish from '../components/Markdownish'
import { useI18n } from '../i18n'
import { pickText } from '../settings'
import { useSiteSettings } from '../siteSettings'

export default function CustomPageView({ slug, back }: { slug: string; back: () => void }) {
  const { lang, t } = useI18n()
  const { settings } = useSiteSettings()
  const page = settings.pages.custom.find((p) => p.slug === slug && p.published)
  if (!page) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-bold">{t.admin.set.notFound}</h1>
        <button type="button" onClick={back} className="mt-4 text-brand underline">{t.admin.set.goHome}</button>
      </section>
    )
  }
  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{pickText(page.title, lang) || page.slug}</h1>
      <Markdownish text={pickText(page.body, lang)} />
    </section>
  )
}
