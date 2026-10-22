import { useMemo, useState } from 'react'

export type MsOption = { value: string; label: string; group?: string; hint?: string }

type Props = {
  label: string
  allLabel: string
  options: MsOption[]
  value: string[]
  onChange: (v: string[]) => void
  countLabel: (n: number) => string
  searchPlaceholder?: string
  clearLabel: string
  groupAllLabel?: string
}

const field = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950'

/** Checkbox dropdown: any number of values, optional grouping and search. Empty selection means "all". */
export default function MultiSelect({ label, allLabel, options, value, onChange, countLabel, searchPlaceholder, clearLabel, groupAllLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const shown = useMemo(() => options.filter((o) => !ql || o.label.toLowerCase().includes(ql) || o.value.toLowerCase() === ql), [options, ql])
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, MsOption[]>()
    for (const o of shown) {
      const g = o.group ?? ''
      if (!map.has(g)) {
        map.set(g, [])
        order.push(g)
      }
      map.get(g)!.push(o)
    }
    return order.map((g) => ({ title: g, items: map.get(g)! }))
  }, [shown])

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const toggleGroup = (items: MsOption[]) => {
    const vals = items.map((i) => i.value)
    const all = vals.every((v) => value.includes(v))
    onChange(all ? value.filter((v) => !vals.includes(v)) : [...new Set([...value, ...vals])])
  }
  const summary = value.length === 0 ? allLabel : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? value[0]) : countLabel(value.length)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" className={`${field} min-w-36 text-left`}>
        {label}: {summary}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 max-h-96 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {options.length > 8 && searchPlaceholder && (
              <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className={`${field} mb-2 w-full`} />
            )}
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="mb-2 text-xs text-brand underline">
                {clearLabel}
              </button>
            )}
            {groups.map((g) => (
              <div key={g.title} className="mb-2">
                {g.title && (
                  <button type="button" onClick={() => toggleGroup(g.items)} className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-brand">
                    {g.title}{groupAllLabel ? ` · ${groupAllLabel}` : ''}
                  </button>
                )}
                {g.items.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="accent-indigo-500" />
                    <span className="flex-1">{o.label}</span>
                    {o.hint && <span className="text-xs text-slate-500">{o.hint}</span>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
