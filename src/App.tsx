import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Credits from './pages/Credits'
import Simulations from './pages/Simulations'
import Placeholder from './pages/Placeholder'
import type { PageId } from './config'

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')

  return (
    <div className="min-h-screen">
      <Sidebar active={page} onSelect={setPage} />
      <main className="px-5 pb-10 pt-16 md:ml-64 md:px-10 md:pt-10">
        {page === 'dashboard' && (
          <Placeholder
            title="Panel"
            text="Teknodoz Sim'e hoş geldin. Persona tabanlı simülasyonlarını buradan yöneteceksin."
          />
        )}
        {page === 'personas' && (
          <Placeholder title="Personalar" text="Sanal kullanıcı personalarını keşfet ve seç." />
        )}
        {page === 'runs' && <Simulations />}
        {page === 'credits' && <Credits />}
      </main>
    </div>
  )
}
