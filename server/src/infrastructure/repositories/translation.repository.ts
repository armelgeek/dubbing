import { db } from '../database/db'
import { translations } from '../database/schema/dubbing'
import { eq, and } from 'drizzle-orm'

export class TranslationRepository {
  async insert(data: { id: string; projectId: string; lang: string; segments: any[] }) {
    await db.insert(translations).values({ ...data })
  }
  async updateSegments(id: string, segments: any[]) {
    await db.update(translations).set({ segments }).where(eq(translations.id, id))
  }
  async findByProjectAndLang(projectId: string, lang: string) {
    return db.query.translations.findFirst({ where: (t, { eq, and }) => and(eq(t.projectId, projectId), eq(t.lang, lang)) })
  }
  async listForProject(projectId: string) {
    return db.query.translations.findMany({ where: (t, { eq }) => eq(t.projectId, projectId) })
  }
}
