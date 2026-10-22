import { useState } from 'react'
import { NAV_ITEMS, type PageId } from '../config'

type Props = { active: PageId; onSelect: (id: PageId) => void }

export default function Sidebar({ active, onSelect }: Props) {
  const [open, setOpen] = useState(false)

  const select = (id: PageId) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Menüyü aç"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-lg bg-slate-800 px-3 py-2 text-lg md:hidden"
      >
        ☰
      </button>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 pb-4 pt-6">
          <div className="text-xl font-bold tracking-tight">
            Tekno<span className="text-brand">doz</span>
          </div>
          <span className="mt-2 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Beta · Erken Erişim
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active === item.id
                  ? 'bg-brand/20 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-500">
          v0.1.0 · Beta erken erişim
        </div>
      </aside>
    </>
  )
}
