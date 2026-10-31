import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Span } from '@c/workflows/telemetry'
import { Logger } from '@c/Logger'
import { makeJSONRequest } from '@/lib/server'
import { frontendTelemetry } from '@/workflows/telemetry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  groupTraces,
  mergeSpans,
  signalCounts,
  summarize,
  waterfall,
  type TraceSummary,
} from './inspectorModel'

const serverUrl = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT}`
const kindOptions = ['command', 'reaction', 'query', 'signal', 'error', 'all']
const kindColors: Record<string, string> = {
  command: 'bg-blue-500',
  http: 'bg-violet-500',
  action: 'bg-teal-500',
  event: 'bg-amber-500',
  listener: 'bg-amber-300',
  reaction: 'bg-emerald-500',
  query: 'bg-sky-400',
  wait: 'bg-neutral-400',
  signal: 'bg-pink-500',
  error: 'bg-red-600',
}

const ms = (value: number) =>
  value < 10 ? `${value.toFixed(1)}ms` : `${Math.round(value)}ms`
const time = (epoch: number) => new Date(epoch).toLocaleTimeString()

const fetchBackendSpans = (traceId?: string) =>
  makeJSONRequest<Span[]>({
    url: `${serverUrl}/telemetry${traceId ? `?traceId=${encodeURIComponent(traceId)}` : ''}`,
    method: 'GET',
  })

// A snapshot of the frontend buffer, refreshed only after new spans arrive.
let snapshot: Span[] = []
let stale = true
const listeners = new Set<() => void>()
const notify = () => {
  stale = true
  for (const listener of listeners) listener()
}
const getSnapshot = () => {
  if (stale) {
    snapshot = frontendTelemetry.recent()
    stale = false
  }
  return snapshot
}
const clearSpans = () => {
  frontendTelemetry.clear()
  notify()
}

/** Follows the frontend buffer while `active`, re-rendering at most once a frame. */
function useFrontendSpans(active: boolean) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return () => {}
      stale = true
      listeners.add(onChange)
      let frame = 0
      const off = frontendTelemetry.subscribe(() => {
        frame ||= requestAnimationFrame(() => {
          frame = 0
          notify()
        })
      })
      return () => {
        off()
        cancelAnimationFrame(frame)
        listeners.delete(onChange)
      }
    },
    [active],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}

function Waterfall({ trace }: { trace: TraceSummary }) {
  const [backend, setBackend] = useState<Span[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    fetchBackendSpans(trace.traceId)
      .then((spans) => current && setBackend(spans))
      .catch((reason: unknown) => {
        if (current) setError(String(reason))
      })
    return () => {
      current = false
    }
  }, [trace.traceId, trace.spans.length])

  const rows = waterfall(mergeSpans(trace.spans, backend))
  const total = Math.max(
    1,
    ...rows.map(({ span, offsetMs }) => offsetMs + span.durationMs),
  )
  return (
    <div className="space-y-1 py-2">
      {error && (
        <p className="text-xs text-danger">
          Backend spans unavailable: {error}
        </p>
      )}
      {rows.map(({ span, depth, offsetMs }) => (
        <div key={span.spanId} className="grid grid-cols-[18rem_1fr] gap-2">
          <div
            className="truncate text-xs"
            style={{ paddingLeft: `${depth * 0.75}rem` }}
            title={span.error?.stack ?? JSON.stringify(span.attrs ?? {})}
          >
            <span className="text-muted-foreground">
              {span.side === 'backend' ? 'be' : 'fe'} {span.kind}
            </span>{' '}
            <span className={span.status === 'error' ? 'text-danger' : ''}>
              {span.name}
            </span>{' '}
            <span className="text-muted-foreground">{ms(span.durationMs)}</span>
          </div>
          <div className="relative h-4 rounded bg-muted">
            <div
              className={`absolute h-4 min-w-0.5 rounded ${
                span.status === 'error'
                  ? 'bg-red-600'
                  : (kindColors[span.kind] ?? 'bg-neutral-500')
              }`}
              style={{
                left: `${(offsetMs / total) * 100}%`,
                width: `${(span.durationMs / total) * 100}%`,
              }}
            />
          </div>
          {span.error && (
            <pre className="col-span-2 overflow-x-auto whitespace-pre-wrap rounded bg-danger/10 p-2 text-xs text-danger">
              {span.error.stack ?? `${span.error.name}: ${span.error.message}`}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

function Traces({ spans }: { spans: Span[] }) {
  const [kind, setKind] = useState('command')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [slowMs, setSlowMs] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  const traces = useMemo(
    () =>
      groupTraces(spans)
        .filter(
          (trace) =>
            (kind === 'all' ||
              trace.spans.some((span) => span.kind === kind)) &&
            (!errorsOnly || trace.errors > 0) &&
            trace.durationMs >= slowMs,
        )
        .slice(0, 200),
    [spans, kind, errorsOnly, slowMs],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={kind} onValueChange={(value) => value && setKind(value)}>
          <SelectTrigger size="sm">
            <span className="text-muted-foreground">Contains:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="inspector-errors"
            checked={errorsOnly}
            onCheckedChange={(checked) => setErrorsOnly(checked)}
          />
          <Label htmlFor="inspector-errors">Errors only</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="inspector-slow">Slower than (ms)</Label>
          <Input
            id="inspector-slow"
            type="number"
            min={0}
            className="h-8 w-20"
            value={slowMs}
            onChange={(event) => setSlowMs(Number(event.target.value) || 0)}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={clearSpans}>
          Clear
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Trace</TableHead>
            <TableHead>Spans</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traces.map((trace) => (
            <Fragment key={trace.traceId}>
              <TableRow
                className="cursor-pointer"
                onClick={() =>
                  setSelected(selected === trace.traceId ? null : trace.traceId)
                }
              >
                <TableCell className="text-xs text-muted-foreground">
                  {time(trace.start)}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{trace.root.name}</span>{' '}
                  <Badge variant="outline">{trace.root.kind}</Badge>{' '}
                  {trace.errors > 0 && (
                    <Badge variant="destructive">{trace.errors} failed</Badge>
                  )}
                </TableCell>
                <TableCell>{trace.spans.length}</TableCell>
                <TableCell className="text-right">
                  {ms(trace.durationMs)}
                </TableCell>
              </TableRow>
              {selected === trace.traceId && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="text-xs text-muted-foreground">
                      trace {trace.traceId}
                    </p>
                    <Waterfall trace={trace} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {!traces.length && (
        <p className="text-sm text-muted-foreground">No matching traces yet.</p>
      )}
    </div>
  )
}

function Summary({ spans }: { spans: Span[] }) {
  const [backend, setBackend] = useState<Span[]>([])
  const load = useCallback(() => {
    fetchBackendSpans()
      .then(setBackend)
      .catch((error: unknown) =>
        Logger.getInstance().warn('Could not load backend telemetry', {
          error,
        }),
      )
  }, [])
  useEffect(load, [load])

  const all = mergeSpans(spans, backend)
  const stats = summarize(all, [
    'command',
    'reaction',
    'action',
    'http',
    'query',
  ])
  const signals = signalCounts(all)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {signals.map(([name, count]) => (
          <Badge
            key={name}
            variant={
              count && name !== 'stream.reconnect' ? 'destructive' : 'outline'
            }
          >
            {name}: {count}
          </Badge>
        ))}
        {!signals.length && <Badge variant="outline">No health signals</Badge>}
        <Button size="sm" variant="ghost" onClick={load}>
          Reload backend
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Error rate</TableHead>
            <TableHead className="text-right">p50</TableHead>
            <TableHead className="text-right">p95</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((row) => (
            <TableRow key={`${row.kind}:${row.name}`}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.kind}</TableCell>
              <TableCell className="text-right">{row.count}</TableCell>
              <TableCell
                className={`text-right ${row.errors ? 'text-danger' : ''}`}
              >
                {((row.errors / row.count) * 100).toFixed(0)}%
              </TableCell>
              <TableCell className="text-right">{ms(row.p50)}</TableCell>
              <TableCell className="text-right">{ms(row.p95)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Dev-only view of commands, events and reactions, joined with the backend's
 * spans for the same trace. Toggle with Ctrl+Shift+O.
 */
export function WorkflowInspector() {
  const [open, setOpen] = useState(false)
  const spans = useFrontendSpans(open)

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', toggle)
    return () => window.removeEventListener('keydown', toggle)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-dvw overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Workflow inspector</SheetTitle>
          <SheetDescription>
            Commands, actions, events and reactions per trace. Ctrl+Shift+O to
            toggle.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="traces" className="px-4 pb-4">
          <TabsList>
            <TabsTrigger value="traces">Traces</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="traces">
            <Traces spans={spans} />
          </TabsContent>
          <TabsContent value="summary">
            <Summary spans={spans} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
