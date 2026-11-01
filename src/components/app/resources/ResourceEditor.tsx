import { useRef } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  frontmatterPlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  type MDXEditorMethods,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import './resourceEditor.css'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openLink } from '@/lib/fileUrls'
import { useResourceAutosave } from '@/lib/hooks/useResourceAutosave'
import type { AutosaveState } from '@/lib/resourceAutosave'
import type { ResourceContent } from '@c/vault/contracts'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { Logger } from '@c/Logger'

const codeLanguages = {
  '': 'Plain text',
  ts: 'TypeScript',
  js: 'JavaScript',
  py: 'Python',
  sh: 'Shell',
  json: 'JSON',
  css: 'CSS',
  md: 'Markdown',
}

const statusLabel: Record<AutosaveState['status'], string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
  conflict: 'Changed outside the app',
}

/**
 * Edits one resource's markdown. Opening never writes: a save only happens
 * after a real edit, so files written elsewhere keep their formatting until
 * the user changes them.
 */
export function ResourceEditor({ initial }: { initial: ResourceContent }) {
  const runtime = useWorkflowRuntime()
  const editorRef = useRef<MDXEditorMethods>(null)
  // `setMarkdown` reports a change too; those are not the user's edits.
  const loading = useRef(false)
  const { state, autosave } = useResourceAutosave(
    initial.id,
    initial.content_hash,
  )

  const reload = async () => {
    try {
      const fresh = await runtime.vault.content(initial.id)
      loading.current = true
      editorRef.current?.setMarkdown(fresh.content ?? '')
      loading.current = false
      autosave.current?.reset(fresh.content_hash)
      await runtime.queries.invalidate(['resourceContent'])
    } catch (error) {
      loading.current = false
      Logger.getInstance().error('Failed to reload resource', { error })
    }
  }

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {state.status === 'saving' && (
          <Loader2 className="size-3 animate-spin" />
        )}
        <span>{statusLabel[state.status]}</span>
        {state.status === 'error' && (
          <>
            <span className="text-destructive">{state.error}</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => void autosave.current?.retry()}
            >
              Retry
            </Button>
          </>
        )}
      </div>

      {state.status === 'conflict' && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <AlertTriangle className="size-4 text-amber-600" />
          <span className="flex-1">
            This file changed outside the app since you opened it.
          </span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Reload theirs
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void autosave.current?.overwrite()}
          >
            Keep mine
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <MDXEditor
          ref={editorRef}
          markdown={initial.content ?? ''}
          className={isDark ? 'dark-theme' : undefined}
          contentEditableClassName="resource-content min-h-[50vh] px-4 py-3"
          placeholder="Start writing…"
          onChange={(markdown, initialNormalize) => {
            if (initialNormalize || loading.current) return
            autosave.current?.edit(markdown)
          }}
          onBlur={() => void autosave.current?.flush()}
          onError={({ error }) =>
            Logger.getInstance().warn('Markdown could not be fully parsed', {
              error,
            })
          }
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin({
              onClickLinkCallback: (url) => void openLink(url),
            }),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
            codeMirrorPlugin({ codeBlockLanguages: codeLanguages }),
            frontmatterPlugin(),
            markdownShortcutPlugin(),
            diffSourcePlugin({ viewMode: 'rich-text' }),
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper options={['rich-text', 'source']}>
                  <UndoRedo />
                  <Separator />
                  <BlockTypeSelect />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <ListsToggle />
                  <CreateLink />
                  <InsertTable />
                  <InsertCodeBlock />
                  <InsertThematicBreak />
                </DiffSourceToggleWrapper>
              ),
            }),
          ]}
        />
      </div>
    </div>
  )
}
