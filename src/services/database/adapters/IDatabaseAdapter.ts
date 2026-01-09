export interface IDatabaseAdapter {
  execute(query: string, values?: unknown[]): Promise<any>
  select<T>(query: string, values?: unknown[]): Promise<T[]>
  close(): Promise<void>
}
