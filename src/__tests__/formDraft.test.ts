import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, createElement } from 'react'
import type { FieldConfig } from '@/components/ui/custom/entityForms/types'

test('a local form draft survives refreshed server values, selector options, and a save error', async () => {
  const browser = new Window({ url: 'http://localhost' })
  const saved = new Map<string, PropertyDescriptor | undefined>()
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Node',
    'Event',
    'MutationObserver',
    'IS_REACT_ACT_ENVIRONMENT',
  ]) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    const value =
      key === 'window'
        ? browser
        : key === 'document'
          ? browser.document
          : key === 'IS_REACT_ACT_ENVIRONMENT'
            ? true
            : Reflect.get(browser, key)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  const { createRoot } = await import('react-dom/client')
  const { GenericForm } =
    await import('@/components/ui/custom/entityForms/GenericForm')
  const container = browser.document.createElement('div')
  browser.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const writes: object[] = []
  const fields: FieldConfig<Record<string, unknown>>[] = [
    { name: 'title', type: 'text', label: 'Title', required: true },
  ]
  /** Records submitted values for later use. */
  const submit = (values: object) => {
    writes.push(values)
  }
  try {
    await act(async () => {
      root.render(
        createElement(GenericForm<Record<string, unknown>>, {
          fields,
          initialValues: { title: 'Stored' },
          onSubmit: submit,
        }),
      )
    })
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        browser.HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'Unsaved draft')
      input.dispatchEvent(new browser.Event('input', { bubbles: true }))
      input.dispatchEvent(new browser.Event('change', { bubbles: true }))
    })
    await act(async () => {
      root.render(
        createElement(GenericForm<Record<string, unknown>>, {
          fields: [
            ...fields,
            { name: 'description', type: 'text', label: 'Description' },
          ],
          initialValues: { title: 'Background update' },
          onSubmit: submit,
          errorMessage: 'Save failed',
        }),
      )
    })
    expect(container.querySelector('input')!.value).toBe('Unsaved draft')
    expect(container.querySelector('[role="alert"]')!.textContent).toBe(
      'Save failed',
    )
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(
          new browser.Event('submit', { bubbles: true, cancelable: true }),
        )
    })
    expect(writes[0]).toMatchObject({ title: 'Unsaved draft' })
  } finally {
    await act(async () => {
      root.unmount()
    })
    await browser.happyDOM.close()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
