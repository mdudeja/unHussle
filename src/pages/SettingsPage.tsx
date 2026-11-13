import { VaultSettings } from '@/components/app/VaultSettings'
import { ExtensionSettings } from '@/components/app/ExtensionSettings'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import { Link } from 'react-router'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { TagsInput } from '@/components/ui/custom/TagsInput'
import type { SchedulerSettings } from '@c/scheduler/contracts'
import {
  getLocalDateString,
  getNowMillis,
  getTimeZoneId,
} from '@c/datetimeUtils'
import { useSchedulerAction } from '@/workflows/schedulerHooks'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SettingsPage() {
  const runtime = useWorkflowRuntime()
  const query = useWorkflowQuery({
    key: 'schedule:settings',
    dependencies: ['schedulerSettings'],
    load: () => runtime.scheduler.settings(),
  })
  return (
    <main className="w-full max-w-3xl mx-auto p-4 space-y-6">
      <Link to="/" className="text-sm text-muted-foreground">
        Back to next task
      </Link>
      <h1 className="text-2xl font-semibold">Your preferences</h1>
      <p className="text-sm text-muted-foreground">
        These help size your stack. They do not create a workday routine.
      </p>
      {query.error && <p role="alert">{query.error}</p>}
      {query.data ? (
        <SettingsForm initial={query.data} />
      ) : (
        <p>Loading preferences…</p>
      )}
      <VaultSettings />
      <ExtensionSettings />
    </main>
  )
}

function SettingsForm({ initial }: { initial: SchedulerSettings }) {
  const [settings, setSettings] = useState(initial)
  const [overrideDate, setOverrideDate] = useState(() =>
    getLocalDateString(getNowMillis(), getTimeZoneId()),
  )
  const [saved, setSaved] = useState(false)
  const runtime = useWorkflowRuntime()
  const { run, busy, error } = useSchedulerAction()
  const numeric = (
    key:
      | 'workMinutes'
      | 'defaultMinutes'
      | 'quickMinutes'
      | 'starterMinutes'
      | 'longMinutes'
      | 'wrapMinutes',
    label: string,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={key === 'workMinutes' ? 0 : 1}
        max={1440}
        value={settings[key]}
        onChange={(e) => {
          setSaved(false)
          setSettings({ ...settings, [key]: Number(e.target.value) })
        }}
      />
    </div>
  )
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          await runtime.commands.execute('scheduler.settings.change', {
            settings,
          })
          setSaved(true)
        })
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wake">Usually awake from</Label>
          <Input
            id="wake"
            type="time"
            required
            value={settings.wake}
            onChange={(e) => {
              setSaved(false)
              setSettings({ ...settings, wake: e.target.value })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sleep">Usually winding down by</Label>
          <Input
            id="sleep"
            type="time"
            required
            value={settings.sleep}
            onChange={(e) => {
              setSaved(false)
              setSettings({ ...settings, sleep: e.target.value })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="work-tags">
            Work tags (also inherited from collections)
          </Label>
          <TagsInput
            id="work-tags"
            value={settings.workTags.map((title) => ({ title }))}
            onChange={(tags) => {
              setSaved(false)
              setSettings({
                ...settings,
                workTags: tags.map((tag) => tag.title),
              })
            }}
          />
        </div>
        {numeric('workMinutes', 'Daily work limit (minutes)')}
      </div>
      <details className="space-y-4">
        <summary className="cursor-pointer">Duration preferences</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {numeric('defaultMinutes', 'Unestimated task (minutes)')}
          {numeric('quickMinutes', 'Unestimated quick task (minutes)')}
          {numeric('starterMinutes', 'Maximum starter length (minutes)')}
          {numeric('longMinutes', 'Long task threshold (minutes)')}
          {numeric(
            'wrapMinutes',
            'Start wrapping up before wind-down or the last task ends (minutes)',
          )}
        </div>
      </details>
      <section className="space-y-3">
        <h2 className="font-medium">A different kind of day</h2>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="override-date">Date</Label>
            <Input
              id="override-date"
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (overrideDate) {
                setSaved(false)
                setSettings({
                  ...settings,
                  overrides: {
                    ...settings.overrides,
                    [overrideDate]: {
                      wake: settings.wake,
                      sleep: settings.sleep,
                      workMinutes: settings.workMinutes,
                    },
                  },
                })
              }
            }}
          >
            Add override
          </Button>
        </div>
        {Object.entries(settings.overrides).map(([date, window]) => (
          <div
            key={date}
            className="border rounded-md p-3 flex flex-wrap gap-3 items-end"
          >
            <span className="self-center text-sm">{date}</span>
            <div>
              <Label htmlFor={`wake-${date}`}>Wake</Label>
              <Input
                id={`wake-${date}`}
                type="time"
                value={window.wake}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: { ...window, wake: e.target.value },
                    },
                  })
                }}
              />
            </div>
            <div>
              <Label htmlFor={`sleep-${date}`}>Wind down</Label>
              <Input
                id={`sleep-${date}`}
                type="time"
                value={window.sleep}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: { ...window, sleep: e.target.value },
                    },
                  })
                }}
              />
            </div>
            <div>
              <Label htmlFor={`work-${date}`}>Work minutes</Label>
              <Input
                id={`work-${date}`}
                className="w-24"
                type="number"
                min={0}
                max={1440}
                value={window.workMinutes ?? settings.workMinutes}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: {
                        ...window,
                        workMinutes: Number(e.target.value),
                      },
                    },
                  })
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const overrides = { ...settings.overrides }
                delete overrides[date]
                setSaved(false)
                setSettings({ ...settings, overrides })
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </section>
      {error && <p role="alert">{error}</p>}
      {saved && (
        <p role="status">
          Preferences saved. Reschedule when you want to apply them to today’s
          stack.
        </p>
      )}
      <Button disabled={busy} type="submit">
        Save preferences
      </Button>
    </form>
  )
}
