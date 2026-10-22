export default function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{text}</p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 dark:border-slate-700 text-sm text-slate-500">
        Yakında — beta erken erişim kapsamında geliştiriliyor.
      </div>
    </section>
  )
}
