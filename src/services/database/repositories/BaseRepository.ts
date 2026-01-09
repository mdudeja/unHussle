import { execute, select } from '@/services/database/db'
import { Entity, EntityCollection, EntitySupporter, TimeEntry } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export abstract class BaseRepository<
  T extends Entity | EntityCollection | EntitySupporter | TimeEntry,
> {
  protected abstract tableName: string

  async create(
    data: Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id'>>,
  ): Promise<T> {
    const id = data.id || uuidv4()
    const now = Date.now()
    const entity = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    } as unknown as T

    const keys = Object.keys(entity)
    const values = Object.values(entity)
    const placeholders = keys.map(() => '?').join(', ')

    const query = `INSERT INTO ${this.tableName} (${keys.join(
      ', ',
    )}) VALUES (${placeholders})`
    await execute(query, values)

    return entity
  }

  async findById(id: string): Promise<T | null> {
    const rows = await select<T>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id],
    )
    return rows.length > 0 ? rows[0] : null
  }

  async findAll(): Promise<T[]> {
    return await select<T>(`SELECT * FROM ${this.tableName}`)
  }

  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at'>>,
  ): Promise<T | null> {
    const updates = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ')
    if (!updates) return await this.findById(id)

    const values = [...Object.values(data), Date.now(), id]
    const query = `UPDATE ${this.tableName} SET ${updates}, updated_at = ? WHERE id = ?`

    await execute(query, values)
    return await this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await execute(`DELETE FROM ${this.tableName} WHERE id = ?`, [
      id,
    ])
    return result.rowsAffected > 0
  }
}
