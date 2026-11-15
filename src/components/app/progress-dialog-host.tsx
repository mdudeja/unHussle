import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStore } from '@/store'
import type { ProgressPrompt } from '@/store/slices/createUISlice'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import {
  isCounting,
  promptFields,
  promptValueError,
  promptValues,
  type PromptField,
} from '@/lib/progress-prompt'
import { ProgressInput } from '@c/types/enums'
import { Logger } from '@c/Logger'

/**
 * The app-wide "where did you get to?" dialog, opened when completed work
 * feeds a counting project or goal. Skipping still keeps the session.
 */
export const ProgressDialogHost = () => {
  const prompt = useStore((state) => state.progressPrompts[0])
  if (!prompt) return null
  // Remount per prompt so entered values and errors don't carry over.
  return (
    <ProgressDialog
      key={prompt.sessions.map(({ id }) => id).join(':')}
      prompt={prompt}
    />
  )
}

const ProgressDialog = ({ prompt }: { prompt: ProgressPrompt }) => {
  const close = useStore((state) => state.closeProgress)
  const runtime = useWorkflowRuntime()
  const items = useWorkflowQuery({
    key: `progress-prompt:${prompt.sessions.map(({ id }) => id).join(':')}`,
    dependencies: ['projects', 'goals'],
    load: () =>
      Promise.all(
        prompt.sessions.map(async (session): Promise<PromptField> => {
          const item = await runtime.services[session.kind].fetchById(
            session.itemId,
          )
          const counting = { ...item, title: String(item.title) }
          if (!isCounting(counting))
            throw new Error(`${counting.title} no longer counts progress`)
          return { session, item: counting }
        }),
      ),
  })
  const [entered, setEntered] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = items.data ?? []
  const { asked } = promptFields(fields)
  const raw = (field: PromptField) =>
    entered[field.session.id] ??
    (field.item.progress_input === ProgressInput.POSITION
      ? String(field.item.progress_done)
      : '')
  const check = (field: PromptField) => {
    const message = promptValueError(field.item, raw(field))
    setErrors((current) => ({ ...current, [field.session.id]: message }))
    return message
  }

  const save = async () => {
    const failed = asked.map(check).filter(Boolean)
    if (failed.length) return
    setBusy(true)
    setError(null)
    try {
      await runtime.commands.execute('scheduler.progress.log', {
        values: promptValues(
          fields,
          Object.fromEntries(
            asked.map((field) => [field.session.id, Number(raw(field))]),
          ),
        ),
      })
      close()
    } catch (err) {
      Logger.getInstance().error('Saving progress failed', { error: err })
      setError(
        err instanceof Error
          ? `${err.message}. Try again, or skip for now.`
          : 'Progress was not saved. Try again, or skip for now.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <DialogHeader>
            <DialogTitle>Where did you get to?</DialogTitle>
            <DialogDescription>
              Your time is saved. Adding where you got to is optional.
            </DialogDescription>
          </DialogHeader>
          {items.error ? (
            <p role="alert" className="text-sm text-destructive">
              {items.error} You can skip this time.
            </p>
          ) : !items.data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            asked.map((field, index) => (
              <ProgressField
                key={field.session.id}
                field={field}
                autoFocus={index === 0}
                value={raw(field)}
                error={errors[field.session.id] ?? null}
                onChange={(value) =>
                  setEntered((current) => ({
                    ...current,
                    [field.session.id]: value,
                  }))
                }
                onBlur={() => check(field)}
              />
            ))
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Skip
            </Button>
            <Button type="submit" disabled={busy || !items.data}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const ProgressField = ({
  field: { session, item },
  value,
  error,
  onChange,
  onBlur,
  autoFocus,
}: {
  field: PromptField
  autoFocus: boolean
  value: string
  error: string | null
  onChange: (value: string) => void
  onBlur: () => void
}) => {
  const id = `progress-${session.id}`
  const position = item.progress_input === ProgressInput.POSITION
  const unit = item.progress_unit
  return (
    <section className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {item.title}: {position ? 'how far did you get?' : 'how much did you do?'}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={position ? item.progress_total : undefined}
          step={1}
          className="w-28"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoFocus={autoFocus}
        />
        <span id={`${id}-hint`} className="text-sm text-muted-foreground">
          {position
            ? `of ${item.progress_total} ${unit}`
            : `${unit} (${item.progress_done} / ${item.progress_total} so far)`}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
