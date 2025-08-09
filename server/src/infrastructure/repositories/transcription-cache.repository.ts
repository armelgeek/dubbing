import { db } from '../database/db'
import { transcriptionCache } from '../database/schema'
import { eq } from 'drizzle-orm'

export class TranscriptionCacheRepository {
  async find(hash: string) {
    return db.select().from(transcriptionCache).where(eq(transcriptionCache.hash, hash)).then(r => r[0] || null)
  }
  async upsert(data: { hash: string; language: string; segments: any[]; duration: number }) {
    const existing = await this.find(data.hash)
    if (!existing) {
      await db.insert(transcriptionCache).values(data)
    }
  }
}
