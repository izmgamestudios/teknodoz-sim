import type { ReactNode } from 'react'
import { safeUrl } from '../settings'

// Minimal, safe markdown: headings, lists, paragraphs, **bold**, [text](url). Everything is rendered as React elements.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={k++}>{m[1]}</strong>)
    else {
      const href = safeUrl(m[3])
      out.push(href ? <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline">{m[2]}</a> : m[2])
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdownish({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim())
        if (!lines.length) return null
        const h = /^(#{1,3})\s+(.*)$/.exec(lines[0])
        if (h && lines.length === 1) {
          const cls = h[1].length === 1 ? 'text-xl font-bold' : h[1].length === 2 ? 'text-lg font-semibold' : 'font-semibold'
          return <div key={i} role="heading" aria-level={h[1].length + 1} className={`${cls} text-slate-900 dark:text-slate-100`}>{inline(h[2])}</div>
        }
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s+/, ''))}</li>)}</ul>
        }
        return <p key={i}>{lines.flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...inline(l)] : inline(l)))}</p>
      })}
    </div>
  )
}
