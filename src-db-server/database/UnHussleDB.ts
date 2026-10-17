import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '@d/database/schemas'
import { join, dirname } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, existsSync } from 'node:fs'
import {
  PreparedQueryConfig,
  SQLitePreparedQuery,
} from 'drizzle-orm/sqlite-core'
import { eq, sql, desc } from 'drizzle-orm'

type preparedQueryType = 'get_all' | 'get_by_id' | 'search' | 'get_paginated'

export class UnHussleDB {
  private dbFilePath?: string
  private static instance: UnHussleDB | null = null
  private db: BunSQLiteDatabase<typeof schema> | null = null
  private dbReady: boolean = false
  private preparedStatements: {
    [key: string]: {
      [key in preparedQueryType]?: SQLitePreparedQuery<PreparedQueryConfig>
    }
  } = {}

  constructor(file_path?: string) {
    this.dbFilePath =
      file_path ||
      process.env.DB_FILE_URL ||
      join(process.cwd(), './db/ecn.unhussle.sqlite')
  }

  public static getInstance(file_path?: string): UnHussleDB {
    if (
      !this.instance ||
      (file_path && this.instance.dbFilePath !== file_path)
    ) {
      this.instance = new UnHussleDB(file_path)
    }
    return this.instance
  }

  public isReady() {
    return this.dbReady
  }

  private initDb() {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const migrationsDir =
      process.env.DB_MIGRATIONS_DIR ||
      join(process.cwd(), './drizzle_migrations')

    migrate(this.db, { migrationsFolder: migrationsDir })

    this.prepareStatements('tasks')
    this.prepareStatements('areas')
    this.prepareStatements('goals')
    this.prepareStatements('projects')
    this.prepareStatements('tags')
    this.prepareStatements('urls')
    this.prepareStatements('timeEntries')
    this.prepareStatements('resources')

    this.dbReady = true
  }

  public async getDb() {
    if (this.db && this.dbReady) {
      return this.db
    }

    // Ensure the parent directory exists
    const dbDir = dirname(this.dbFilePath!)

    if (!existsSync(dbDir)) {
      console.log(`Creating database directory: ${dbDir}`)
      mkdirSync(dbDir, { recursive: true })
    }

    const sqlite = new Database(this.dbFilePath)

    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA synchronous = NORMAL;')

    this.db = drizzle({ client: sqlite, schema })

    if (!this.dbReady) {
      this.initDb()
    }

    return this.db
  }

  private prepareStatements(name: string) {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const nameToTableMap = {
      tasks: schema.tasks,
      areas: schema.areas,
      goals: schema.goals,
      projects: schema.projects,
      tags: schema.tags,
      urls: schema.urls,
      timeEntries: schema.timeEntries,
      resources: schema.resources,
    }

    const nameToTagsColumnMap = {
      projects: schema.projects.project_tag,
      areas: schema.areas.area_tag,
      goals: schema.goals.goal_tag,
    }

    const table = nameToTableMap[name as keyof typeof nameToTableMap]

    // Only projects/areas/goals have a hashtag column. Interpolating an
    // `undefined` column would emit invalid SQL (`... or  LIKE ?`), so the tag
    // clause is only added for tables that actually have one.
    const tagColumn =
      name in nameToTagsColumnMap
        ? nameToTagsColumnMap[name as keyof typeof nameToTagsColumnMap]
        : undefined

    const searchCondition = tagColumn
      ? sql`lower(${table.title}) LIKE ${sql.placeholder('term')} or lower(${tagColumn}) LIKE ${sql.placeholder('term')}`
      : sql`lower(${table.title}) LIKE ${sql.placeholder('term')}`

    this.preparedStatements[name] = {
      get_all: this.db.select().from(table).prepare(),
      get_by_id: this.db
        .select()
        .from(table)
        .where(eq(table.id, sql.placeholder('id')))
        .limit(1)
        .prepare(),
      get_paginated: this.db
        .select()
        .from(table)
        .orderBy(desc(table.updated_at))
        .limit(sql.placeholder('limit'))
        .offset(sql.placeholder('offset'))
        .prepare(),
      search: this.db
        .select()
        .from(table)
        .where(searchCondition)
        .limit(sql.placeholder('limit'))
        .prepare(),
    }
  }

  public getPreparedStatement(tableName: string, type: preparedQueryType) {
    return this.preparedStatements[tableName]?.[type]
  }
}
