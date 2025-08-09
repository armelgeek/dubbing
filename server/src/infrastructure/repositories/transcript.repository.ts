import { db } from '../database/db'
import { transcripts } from '../database/schema/dubbing'
import { eq, and } from 'drizzle-orm'

export class TranscriptRepository {
  async insert(data: { id: string; projectId: string; language: string; segments: any[] }) {
    await db.insert(transcripts).values({ ...data })
  }
  async updateSegments(id: string, segments: any[]) {
    await db.update(transcripts).set({ segments }).where(eq(transcripts.id, id))
  }
  async findByProjectAndLanguage(projectId: string, language: string) {
    return db.query.transcripts.findFirst({ where: (t, { eq, and }) => and(eq(t.projectId, projectId), eq(t.language, language)) })
  }
  async listForProject(projectId: string) {
    return db.query.transcripts.findMany({ where: (t, { eq }) => eq(t.projectId, projectId) })
  }
}
