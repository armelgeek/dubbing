import { db } from '../database/db'
import { jobs } from '../database/schema/dubbing'
import { eq } from 'drizzle-orm'

export class JobRepository {
  async upsert(data: { id: string; projectId: string; kind: string }) {
    const existing = await db.query.jobs.findFirst({ where: (j, { eq }) => eq(j.id, data.id) })
    if (!existing) {
      await db.insert(jobs).values({ ...data, status: 'PENDING', progress: 0 })
    }
  }
  async setRunning(id: string) {
    await db.update(jobs).set({ status: 'RUNNING', startedAt: new Date() }).where(eq(jobs.id, id))
  }
  async setProgress(id: string, progress: number) {
    await db.update(jobs).set({ progress }).where(eq(jobs.id, id))
  }
  async setDone(id: string) {
    await db.update(jobs).set({ status: 'DONE', progress: 100, finishedAt: new Date() }).where(eq(jobs.id, id))
  }
  async setError(id: string, error: string) {
    await db.update(jobs).set({ status: 'ERROR', error }).where(eq(jobs.id, id))
  }
  async listForProject(projectId: string) {
    return db.query.jobs.findMany({ where: (j, { eq }) => eq(j.projectId, projectId) })
  }
}
