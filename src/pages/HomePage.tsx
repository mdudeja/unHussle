import { BrainDumpInputComponent } from '@/components/app'
import { NextTaskCardComponent } from '@/components/app/NextTaskCard'
import { PageViewComponent } from '@/components/pages/PageView'
import { useStore } from '@/store'
import { useEffect } from 'react'

export default function HomePage() {
  const { tasks, areas, goals, projects } = useStore()

  useEffect(() => {
    if (
      tasks.data.length > 0 ||
      tasks.isLoading ||
      areas.data.length > 0 ||
      areas.isLoading ||
      goals.data.length > 0 ||
      goals.isLoading ||
      projects.data.length > 0 ||
      projects.isLoading
    ) {
      return
    }
    tasks.fetch()
    areas.fetch()
    goals.fetch()
    projects.fetch()
  }, [tasks, areas, goals, projects])

  return (
    <PageViewComponent>
      <section className="w-full space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <NextTaskCardComponent />
      </section>

      {/* Brain Dump Section */}
      <section className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8">
        <BrainDumpInputComponent />
      </section>
    </PageViewComponent>
  )
}
