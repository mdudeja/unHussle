import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TimerDisplay } from '@/components/ui/custom/TimerDisplay'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function DesignSystemComponent({ ref }: React.ComponentProps<'div'>) {
  const [timerValue, setTimerValue] = useState(0)

  // Simple timer effect
  useState(() => {
    const interval = setInterval(() => {
      setTimerValue((p) => p + 1)
    }, 1000)
    return () => clearInterval(interval)
  })

  return (
    <div ref={ref} className="p-8 space-y-10 max-w-4xl mx-auto pb-20">
      <header>
        <h1 className="text-3xl font-heading font-bold text-text mb-2">
          Design System
        </h1>
        <p className="text-muted-foreground">
          Visual verification of UI components.
        </p>
      </header>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="default">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link Button</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">Icon</Button>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Badges
        </h2>
        <div className="flex flex-wrap gap-4">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Inputs & Textareas
        </h2>
        <div className="grid gap-4 max-w-md">
          <Input placeholder="Default Input" />
          <Input placeholder="Error Input" aria-invalid />
          <Input placeholder="Disabled Input" disabled />
          <Textarea placeholder="Type your notes here..." />
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>
                This is a standard card container
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Content goes here. It uses the calm shadow style.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Feedback & Display */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Feedback & Display
        </h2>
        <div className="space-y-6 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium">Progress Bar</label>
            <Progress value={66} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Timer Display</label>
            <div className="flex gap-8 items-end">
              <TimerDisplay seconds={timerValue} size="xl" />
              <TimerDisplay seconds={timerValue} size="md" variant="muted" />
            </div>
          </div>
        </div>
      </section>

      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove your data from our servers.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
