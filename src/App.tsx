import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Admin from './pages/Admin'
import Credits from './pages/Credits'
import Faq from './pages/Faq'
import Guide from './pages/Guide'
import Dashboard from './pages/Dashboard'
import Personas from './pages/Personas'
import Simulations from './pages/Simulations'
import Study from './pages/Study'
import type { PageId } from './config'

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')

  return (
    <div className="min-h-screen">
      <Sidebar active={page} onSelect={setPage} />
      <main className="px-5 pb-10 pt-16 md:ml-64 md:px-10 md:pt-10">
        {page === 'dashboard' && <Dashboard go={setPage} />}
        {page === 'personas' && <Personas go={setPage} />}
        {page === 'runs' && <Simulations go={setPage} />}
        {page === 'study' && <Study go={setPage} />}
        {page === 'guide' && <Guide go={setPage} />}
        {page === 'faq' && <Faq />}
        {page === 'admin' && <Admin />}
        {page === 'credits' && <Credits />}
      </main>
    </div>
  )
}
