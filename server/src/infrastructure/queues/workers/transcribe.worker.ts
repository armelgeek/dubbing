import { Worker } from 'bullmq'
import { JobKind, JobStatus } from '../../../../../shared/src/types/job'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { TranscriptRepository } from '../../../infrastructure/repositories/transcript.repository'
import { TranscriptionCacheRepository } from '../../../infrastructure/repositories/transcription-cache.repository'
import { randomUUID } from 'crypto'
import { Providers } from '../../../infrastructure/providers/provider.factory'
import { hashFile } from '../../../infrastructure/util/audio-hash.util'
import { recordJobStart, recordJobEnd } from '../../../infrastructure/metrics/metrics.registry'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const transcriptRepo = new TranscriptRepository()
const cacheRepo = new TranscriptionCacheRepository()

async function processTranscribe(job: any) {
  const startedAt = Date.now()
  const { projectId, jobId } = job.data
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.TRANSCRIBE)
  emitJobProgress({ projectId, kind: JobKind.TRANSCRIBE, status: JobStatus.RUNNING, progress: 0 })
  const audioPath = `/tmp/${projectId}.wav`
  const fileHash = await hashFile(audioPath).catch(() => null)
  if (fileHash) {
    const cached = await cacheRepo.find(fileHash)
    if (cached) {
      await transcriptRepo.insert({ id: randomUUID(), projectId, language: cached.language, segments: cached.segments })
      await jobRepo.setProgress(jobId, 100)
      await jobRepo.setDone(jobId)
      recordJobEnd(JobKind.TRANSCRIBE, Date.now() - startedAt, true)
      emitJobProgress({ projectId, kind: JobKind.TRANSCRIBE, status: JobStatus.DONE, progress: 100 })
      return { language: cached.language, segments: cached.segments.length, cached: true }
    }
  }
  const transcription = Providers.transcription()
  const result = await transcription.transcribe(audioPath, (p) => {
    jobRepo.setProgress(jobId, p).catch(() => {})
    emitJobProgress({ projectId, kind: JobKind.TRANSCRIBE, status: JobStatus.RUNNING, progress: p })
  })
  if (fileHash) {
    cacheRepo.upsert({ hash: fileHash, language: result.language, segments: result.segments, duration: result.segments.at(-1)?.end || 0 }).catch(() => {})
  }
  await transcriptRepo.insert({ id: randomUUID(), projectId, language: result.language, segments: result.segments })
  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.TRANSCRIBE, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.TRANSCRIBE, status: JobStatus.DONE, progress: 100 })
  return { language: result.language, segments: result.segments.length }
}

export const transcribeWorker = new Worker(JobKind.TRANSCRIBE, processTranscribe, { connection })

transcribeWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    emitJobProgress({ projectId: data.projectId, kind: JobKind.TRANSCRIBE, status: JobStatus.ERROR, progress: 0, error: err.message })
    recordJobEnd(JobKind.TRANSCRIBE, 0, false)
  }
})
