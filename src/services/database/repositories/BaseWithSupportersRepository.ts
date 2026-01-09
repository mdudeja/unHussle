import { EntityWithTagsAndUrls, Entity, Tag, EntityUrl } from '@/types'
import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { execute, select } from '@/services/database/db'

export abstract class BaseWithSupportersRepository<
  T extends Entity,
  U extends EntityWithTagsAndUrls<T>,
> extends BaseRepository<T> {
  protected abstract tableName: string
  protected abstract tagsJunctionTable: string
  protected abstract urlsJunctionTable: string

  async findById(id: string): Promise<U | null> {
    const entity = await super.findById(id)

    if (!entity) {
      return null
    }

    const tags = await select<Tag>(
      `SELECT * FROM tags WHERE id IN (SELECT tag_id FROM ${this.tagsJunctionTable} WHERE entity_id = ?)`,
      [id],
    )

    const urls = await select<EntityUrl>(
      `SELECT * FROM entity_urls WHERE id IN (SELECT entity_url_id FROM ${this.urlsJunctionTable} WHERE entity_id = ?)`,
      [id],
    )

    return { ...entity, tags, urls } as U
  }

  async findAll(): Promise<U[]> {
    const entities = await super.findAll()

    if (!entities.length) {
      return []
    }

    const tags = await select<Tag>(
      `SELECT * FROM tags WHERE id IN (SELECT tag_id FROM ${this.tagsJunctionTable} WHERE entity_id IN (?))`,
      [entities.map((entity) => entity.id)],
    )

    const urls = await select<EntityUrl>(
      `SELECT * FROM entity_urls WHERE id IN (SELECT entity_url_id FROM ${this.urlsJunctionTable} WHERE entity_id IN (?))`,
      [entities.map((entity) => entity.id)],
    )

    return entities.map((entity) => ({
      ...entity,
      tags,
      urls,
    })) as U[]
  }

  async createWithTagsAndUrls(
    entity: T,
    tags: Tag[],
    urls: EntityUrl[],
  ): Promise<U | null> {
    const entityRow = await super.create(entity)

    if (!entityRow) {
      return null
    }

    await this._createTagJunction(
      entityRow.id,
      tags.map((tag) => tag.id),
    )
    await this._createUrlJunction(
      entityRow.id,
      urls.map((url) => url.id),
    )

    return { ...entityRow, tags, urls } as U
  }

  async addTags(entityId: string, tags: Tag[]): Promise<void> {
    await this._createTagJunction(
      entityId,
      tags.map((tag) => tag.id),
    )
  }

  async addUrls(entityId: string, urls: string[]): Promise<void> {
    await this._createUrlJunction(entityId, urls)
  }

  async removeTags(entityId: string, tags: Tag[]): Promise<void> {
    await this._deleteTagJunction(
      entityId,
      tags.map((tag) => tag.id),
    )
  }

  async removeUrls(entityId: string, urls: string[]): Promise<void> {
    await this._deleteUrlJunction(entityId, urls)
  }

  async updateWithTagsAndUrls(
    entityId: string,
    entity: T,
    tags: Tag[],
    urls: EntityUrl[],
  ): Promise<U | null> {
    const entityRow = await super.update(entityId, entity)

    if (!entityRow) {
      return null
    }

    await this._updateTagJunction(
      entityId,
      tags.map((tag) => tag.id),
    )
    await this._updateUrlJunction(
      entityId,
      urls.map((url) => url.id),
    )
    return { ...entityRow, tags, urls } as U
  }

  private async _createTagJunction(
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    if (!tagIds.length) {
      return
    }

    for (const tagId of tagIds) {
      await execute(
        `INSERT INTO ${this.tagsJunctionTable} (entity_id, tag_id) VALUES (?, ?)`,
        [entityId, tagId],
      )
    }
  }

  private async _createUrlJunction(
    entityId: string,
    urlIds: string[],
  ): Promise<void> {
    if (!urlIds.length) {
      return
    }

    for (const urlId of urlIds) {
      await execute(
        `INSERT INTO ${this.urlsJunctionTable} (entity_id, entity_url_id) VALUES (?, ?)`,
        [entityId, urlId],
      )
    }
  }

  private async _deleteTagJunction(
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    if (!tagIds.length) {
      return
    }

    await execute(
      `DELETE FROM ${this.tagsJunctionTable} WHERE entity_id = ? AND tag_id IN (?)`,
      [entityId, tagIds],
    )
  }

  private async _deleteUrlJunction(
    entityId: string,
    urlIds: string[],
  ): Promise<void> {
    if (!urlIds.length) {
      return
    }

    await execute(
      `DELETE FROM ${this.urlsJunctionTable} WHERE entity_id = ? AND entity_url_id IN (?)`,
      [entityId, urlIds],
    )
  }

  private async _updateTagJunction(
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    if (!tagIds.length) {
      return
    }

    await this._deleteTagJunction(entityId, tagIds)
    await this._createTagJunction(entityId, tagIds)
  }

  private async _updateUrlJunction(
    entityId: string,
    urlIds: string[],
  ): Promise<void> {
    if (!urlIds.length) {
      return
    }

    await this._deleteUrlJunction(entityId, urlIds)
    await this._createUrlJunction(entityId, urlIds)
  }
}
