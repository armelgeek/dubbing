import { db } from '../database/db'
import { projects } from '../database/schema/dubbing'
import { eq } from 'drizzle-orm'

export class ProjectRepository {
  async findById(id: string) {
    return db.query.projects.findFirst({ where: (p, { eq }) => eq(p.id, id) })
  }
  async create(data: { id: string; userId: string; title: string; sourceVideoUrl?: string | null }) {
    await db.insert(projects).values({ ...data, status: 'DRAFT' })
    return this.findById(data.id)
  }
  async updateStatus(id: string, status: string) {
    await db.update(projects).set({ status }).where(eq(projects.id, id))
  }
}
