export interface IRepository<
  T extends { Read: unknown; Write: unknown; Update: unknown },
> {
  getAll(): Promise<T['Read'][]>
  getPaginated(page: number, pageSize: number): Promise<T['Read'][]>
  getById(id: string): Promise<T['Read'] | null>
  search(query: string, limit: number): Promise<T['Read'][]>
}
