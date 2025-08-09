import { Worker } from 'bullmq'
import { JobKind, JobStatus } from '../../../../../shared/src/types/job'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { recordJobStart, recordJobEnd } from '../../../infrastructure/metrics/metrics.registry'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()

async function processLipSync(job: any) {
  const startedAt = Date.now()
  const { projectId, targetLangs, jobId } = job.data as { projectId: string; targetLangs: string[]; jobId: string }
  if (process.env.ENABLE_LIPSYNC !== 'true') {
    await jobRepo.setDone(jobId).catch(() => {})
    emitJobProgress({ projectId, kind: JobKind.LIPSYNC, status: JobStatus.DONE, progress: 100 })
    recordJobEnd(JobKind.LIPSYNC, 0, true)
    return { skipped: true }
  }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.LIPSYNC)
  emitJobProgress({ projectId, kind: JobKind.LIPSYNC, status: JobStatus.RUNNING, progress: 0 })
  await new Promise(r => setTimeout(r, 100))
  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.LIPSYNC, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.LIPSYNC, status: JobStatus.DONE, progress: 100 })
  return { projectId, lipsynced: targetLangs }
}

export const lipSyncWorker = new Worker(JobKind.LIPSYNC, processLipSync, { connection })

lipSyncWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    emitJobProgress({ projectId: data.projectId, kind: JobKind.LIPSYNC, status: JobStatus.ERROR, progress: 0, error: err.message })
    recordJobEnd(JobKind.LIPSYNC, 0, false)
  }
})
