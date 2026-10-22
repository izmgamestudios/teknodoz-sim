import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Admin from './pages/Admin'
import Credits from './pages/Credits'
import Faq from './pages/Faq'
import Placeholder from './pages/Placeholder'
import Simulations from './pages/Simulations'
import type { PageId } from './config'
import { useI18n } from './i18n'

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const { t } = useI18n()

  return (
    <div className="min-h-screen">
      <Sidebar active={page} onSelect={setPage} />
      <main className="px-5 pb-10 pt-16 md:ml-64 md:px-10 md:pt-10">
        {page === 'dashboard' && <Placeholder title={t.dashboard.title} text={t.dashboard.text} />}
        {page === 'personas' && <Placeholder title={t.personas.title} text={t.personas.text} />}
        {page === 'runs' && <Simulations go={setPage} />}
        {page === 'faq' && <Faq />}
        {page === 'admin' && <Admin />}
        {page === 'credits' && <Credits />}
      </main>
    </div>
  )
}
