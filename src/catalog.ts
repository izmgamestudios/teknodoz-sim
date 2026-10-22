import { useMemo } from 'react'
import { useSiteSettings } from './siteSettings'
import { MODELS, TASKS } from './tasks'

/** Catalog tasks and models after the admin's seed-data filters (never empty). */
export function useCatalog() {
  const { settings } = useSiteSettings()
  const { hiddenTasks, models } = settings.seed
  return useMemo(() => {
    const tasks = TASKS.filter((x) => !hiddenTasks.includes(x.id))
    return { tasks: tasks.length ? tasks : TASKS, models: [...MODELS, ...models.filter((m) => !MODELS.includes(m))] }
  }, [hiddenTasks, models])
}
