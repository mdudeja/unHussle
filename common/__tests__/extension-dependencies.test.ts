import { expect, test } from 'bun:test'
import {
  dependencyIssues,
  dependentsOf,
  requirementsOf,
  sortByDependencies,
} from '@c/extensions/dependencies'

const nodes = [
  { id: 'stats', requires: ['tracker'] },
  { id: 'tracker', requires: ['kanban'] },
  { id: 'kanban' },
  { id: 'other' },
]

test('items are sorted after what they need, else kept in order', () => {
  expect(sortByDependencies(nodes, (node) => node).map(({ id }) => id)).toEqual(
    ['kanban', 'tracker', 'stats', 'other'],
  )
})

test('requirements and dependents include indirect ones, in start order', () => {
  expect(requirementsOf(nodes, 'stats')).toEqual(['kanban', 'tracker'])
  expect(dependentsOf(nodes, 'kanban')).toEqual(['tracker', 'stats'])
  expect(dependentsOf(nodes, 'other')).toEqual([])
})

test('issues cover self, missing, cycles and what needs them', () => {
  const issues = dependencyIssues([
    { id: 'self', requires: ['self'] },
    { id: 'a', requires: ['b'] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['a'] },
    { id: 'd', requires: ['gone'] },
    { id: 'fine' },
  ])
  expect(Object.fromEntries(issues)).toEqual({
    self: "An extension can't need itself",
    a: 'Dependency cycle: a -> b -> a',
    b: 'Dependency cycle: a -> b -> a',
    c: `Needs "a", which can't load`,
    d: `Needs "gone", which isn't installed`,
  })
})
