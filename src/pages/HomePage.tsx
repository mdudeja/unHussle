import { BrainDumpInputComponent } from '@/components/app/BrainDumpInput'
import { NextTaskCardComponent } from '@/components/app/NextTaskCard'
import { PageViewComponent } from '@/components/pages/PageView'

export default function HomePage() {
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
