import { BrainDumpInputComponent, CreateEntityButton } from '@/components/app'
import { NextTaskCardComponent } from '@/components/app/NextTaskCard'
import { PageViewComponent } from '@/components/pages/PageView'

export default function HomePage() {
  return (
    <PageViewComponent>
      {/* Top actions */}
      <div className="flex w-full justify-end animate-in fade-in slide-in-from-top-4 duration-700">
        <CreateEntityButton kind="projects" />
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
