import { Link } from 'react-router'
import { Fragment } from 'react'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import {
  formatHotkey,
  HOTKEY_SCOPES,
  HOTKEYS,
  HotkeyDefinition,
  HotkeyScope,
} from '@/lib/hotkeys'

const DEV_SCOPE: HotkeyScope = 'Developer tools'

export function KeyboardShortcutsPage() {
  const scopes = HOTKEY_SCOPES.filter(
    (scope) => scope !== DEV_SCOPE || import.meta.env.DEV,
  )
  const hotkeys: HotkeyDefinition[] = Object.values(HOTKEYS)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <Link to="/" className="text-sm text-muted-foreground">
        Back to next task
      </Link>
      <h1 className="text-2xl font-semibold">Keyboard shortcuts</h1>
      {scopes.map((scope) => (
        <section key={scope} className="flex flex-col gap-2">
          <h2 className="font-medium">{scope}</h2>
          <ItemGroup className="gap-2">
            {hotkeys
              .filter((hotkey) => hotkey.scope === scope)
              .map((hotkey) => (
                <Item
                  key={hotkey.id}
                  role="listitem"
                  variant="outline"
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>{hotkey.title}</ItemTitle>
                    <ItemDescription>{hotkey.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <HotkeyKeys hotkey={hotkey} />
                  </ItemActions>
                </Item>
              ))}
          </ItemGroup>
        </section>
      ))}
    </main>
  )
}

function HotkeyKeys({ hotkey }: { hotkey: HotkeyDefinition }) {
  return formatHotkey(hotkey).map((combination, index) => (
    <Fragment key={combination.join('+')}>
      {index > 0 && <span className="text-xs text-muted-foreground">or</span>}
      <KbdGroup>
        {combination.map((key, keyIndex) => (
          <Fragment key={key}>
            {keyIndex > 0 && (
              <span className="text-xs text-muted-foreground">+</span>
            )}
            <Kbd>{key}</Kbd>
          </Fragment>
        ))}
      </KbdGroup>
    </Fragment>
  ))
}
