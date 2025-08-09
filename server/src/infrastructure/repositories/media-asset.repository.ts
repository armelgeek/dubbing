import { db } from '../database/db'
import { mediaAssets } from '../database/schema/dubbing'
import { eq } from 'drizzle-orm'

export class MediaAssetRepository {
  async insert(data: { id: string; projectId: string; type: string; url: string; meta?: Record<string, any> }) {
    await db.insert(mediaAssets).values({ ...data, meta: data.meta || {} })
  }
  async listForProject(projectId: string) {
    return db.query.mediaAssets.findMany({ where: (m, { eq }) => eq(m.projectId, projectId) })
  }
  async findByType(projectId: string, type: string) {
    return db.query.mediaAssets.findFirst({ where: (m, { and, eq }) => and(eq(m.projectId, projectId), eq(m.type, type)) })
  }
  async delete(id: string) {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id))
  }
}
