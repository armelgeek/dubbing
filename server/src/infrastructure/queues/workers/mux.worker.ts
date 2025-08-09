import { Worker } from 'bullmq'
import { JobKind, JobStatus } from '../../../../../shared/src/types/job'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { MediaAssetRepository } from '../../../infrastructure/repositories/media-asset.repository'
import { ProjectRepository } from '../../../infrastructure/repositories/project.repository'
import { randomUUID } from 'crypto'
import { recordJobStart, recordJobEnd } from '../../../infrastructure/metrics/metrics.registry'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const mediaRepo = new MediaAssetRepository()
const projectRepo = new ProjectRepository()

async function processMux(job: any) {
  const startedAt = Date.now()
  const { projectId, jobId } = job.data as { projectId: string; jobId: string }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.MUX)
  emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.RUNNING, progress: 0 })
  await new Promise(r => setTimeout(r, 120))
  const finalPath = `/tmp/${projectId}_final.mp4`
  await mediaRepo.insert({ id: randomUUID(), projectId, type: 'FINAL_VIDEO', url: finalPath })
  await projectRepo.updateStatus(projectId, 'COMPLETED').catch(() => {})
  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.MUX, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.DONE, progress: 100 })
  return { projectId, muxed: true }
}

export const muxWorker = new Worker(JobKind.MUX, processMux, { connection })

muxWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    recordJobEnd(JobKind.MUX, 0, false)
    emitJobProgress({ projectId: data.projectId, kind: JobKind.MUX, status: JobStatus.ERROR, progress: 0, error: err.message })
  }
})
