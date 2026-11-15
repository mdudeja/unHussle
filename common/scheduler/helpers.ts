export function arrayWithout<T>({
  list,
  exclude,
}: {
  list: ReadonlyArray<T>
  exclude: ReadonlyArray<T>
}): T[] {
  type ListMember = (typeof list)[number]
  type ExcludedMember = (typeof exclude)[number]

  function isExcluded(item: ListMember): item is ExcludedMember {
    return exclude.includes(item)
  }

  return list.filter((item) => !isExcluded(item))
}
