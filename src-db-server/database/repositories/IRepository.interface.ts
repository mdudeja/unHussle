export interface IRepository<
  T extends { Read: unknown; Write: unknown; Update: unknown },
> {
  getAll(): Promise<T['Read'][]>
  getPaginated(page: number, pageSize: number): Promise<T['Read'][]>
  getById(id: string): Promise<T['Read'] | null>
  search(query: string, limit: number): Promise<T['Read'][]>
  add(entity: T['Write']): Promise<T['Read'] | null>
  update(id: string, entity: T['Update']): Promise<T['Read'] | null>
  delete(id: string): Promise<T['Read'] | null>
  deleteAll(): Promise<number>
}
