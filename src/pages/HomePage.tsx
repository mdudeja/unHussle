import {
  BrainDumpInputComponent,
  CreateProjectButtonComponent,
} from '@/components/app'
import { NextTaskCardComponent } from '@/components/app/NextTaskCard'
import { PageViewComponent } from '@/components/pages/PageView'
import { useEntryList } from '@/workflows/hooks'

export default function HomePage() {
  useEntryList('tasks')
  useEntryList('areas')
  useEntryList('goals')
  useEntryList('projects')

  return (
    <PageViewComponent>
      {/* Top actions */}
      <div className="flex w-full justify-end animate-in fade-in slide-in-from-top-4 duration-700">
        <CreateProjectButtonComponent />
      </div>

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
