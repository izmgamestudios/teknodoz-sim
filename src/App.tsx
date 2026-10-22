import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { useI18n } from './i18n'
import { entryAvailable, entryRoute, routeAvailable, type Route } from './nav'
import Admin from './pages/Admin'
import Credits from './pages/Credits'
import CustomPageView from './pages/CustomPageView'
import Faq from './pages/Faq'
import Guide from './pages/Guide'
import Dashboard from './pages/Dashboard'
import Personas from './pages/Personas'
import Simulations from './pages/Simulations'
import Study from './pages/Study'
import { useSiteSettings } from './siteSettings'

// Pages are addressed as #/<id> (or #/page:<slug>) so a page hidden from the menus, notably #/admin, stays reachable.
const fromHash = (): Route | null => {
  const m = /^#\/([a-z0-9:-]{1,50})$/.exec(location.hash)
  return m ? m[1] : null
}

export default function App() {
  const { settings, loaded } = useSiteSettings()
  const { t } = useI18n()
  const [route, setRoute] = useState<Route | null>(fromHash)

  useEffect(() => {
    const on = () => setRoute(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = useCallback((r: Route) => {
    setRoute(r)
    history.replaceState(null, '', `#/${r}`)
    window.scrollTo(0, 0)
  }, [])

  const first = settings.sidebar.items.filter((e) => entryAvailable(e, settings)).map(entryRoute).find(Boolean) ?? 'dashboard'
  const page: Route = route ?? first

  if (!loaded) return <div className="min-h-screen" aria-busy="true" />

  const body = !routeAvailable(page, settings) ? (
    <section className="max-w-xl">
      <h1 className="text-2xl font-bold">{t.admin.set.notFound}</h1>
      <button type="button" onClick={() => go(first)} className="mt-4 text-brand underline">{t.admin.set.goHome}</button>
    </section>
  ) : page.startsWith('page:') ? (
    <CustomPageView slug={page.slice(5)} back={() => go(first)} />
  ) : (
    <>
      {page === 'dashboard' && <Dashboard go={go} />}
      {page === 'personas' && <Personas go={go} />}
      {page === 'runs' && <Simulations go={go} />}
      {page === 'study' && <Study go={go} />}
      {page === 'guide' && <Guide go={go} />}
      {page === 'faq' && <Faq />}
      {page === 'admin' && <Admin />}
      {page === 'credits' && <Credits />}
    </>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Sidebar active={page} onSelect={go} />
      <SiteHeader active={page} go={go} />
      <main
        className={`flex-1 px-5 pb-10 pt-16 md:ml-[var(--sidebar-w)] md:px-10 ${settings.design.density === 'compact' ? 'md:pt-6' : 'md:pt-10'}`}
      >
        {body}
      </main>
      <SiteFooter go={go} />
    </div>
  )
}
