import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { TimerDisplay } from '@/components/ui/TimerDisplay'
import { Modal } from '@/components/ui/Modal'

export function DesignSystem() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [timerValue, setTimerValue] = useState(0)

  // Simple timer effect
  useState(() => {
    const interval = setInterval(() => {
      setTimerValue((p) => p + 1)
    }, 1000)
    return () => clearInterval(interval)
  })

  return (
    <div className="p-8 space-y-10 max-w-4xl mx-auto pb-20">
      <header>
        <h1 className="text-3xl font-heading font-bold text-text mb-2">
          Design System
        </h1>
        <p className="text-muted">Visual verification of UI components.</p>
      </header>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link Button</Button>
          <Button disabled>Disabled</Button>
          <Button isLoading>Loading</Button>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
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
          <Badge variant="danger">Danger</Badge>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Inputs & Textareas
        </h2>
        <div className="grid gap-4 max-w-md">
          <Input placeholder="Default Input" />
          <Input placeholder="Error Input" error />
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

          <Card variant="flat">
            <CardHeader>
              <CardTitle>Flat Card</CardTitle>
              <CardDescription>
                Used for secondary content areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card has no shadow and uses a secondary background.</p>
            </CardContent>
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

          <div>
            <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
          </div>
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Example Modal"
        description="This is how the modal component looks."
      >
        <div className="space-y-4">
          <p>You can put any content here. It overlays the rest of the app.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
