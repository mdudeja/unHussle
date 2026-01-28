import React from 'react'
import { BrainDumpInput } from '@/components/home/BrainDumpInput'
import { NextTaskCard } from '@/components/home/NextTaskCard'

export const HomeView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto px-4 gap-12">
      <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Next Task Section */}
        <section className="w-full">
          <NextTaskCard />
        </section>

        {/* Brain Dump Section */}
        <section className="w-full pt-8">
          <BrainDumpInput />
        </section>
      </div>
    </div>
  )
}
