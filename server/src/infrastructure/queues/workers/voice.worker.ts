import { Worker } from 'bullmq'
import { JobKind, JobStatus, type SegmentTiming } from '../../../../../shared/src/types/job'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { TranslationRepository } from '../../../infrastructure/repositories/translation.repository'
import { MediaAssetRepository } from '../../../infrastructure/repositories/media-asset.repository'
import { randomUUID } from 'crypto'
import { Providers } from '../../../infrastructure/providers/provider.factory'
import { recordJobStart, recordJobEnd } from '../../../infrastructure/metrics/metrics.registry'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const translationRepo = new TranslationRepository()
const mediaRepo = new MediaAssetRepository()

async function processVoice(job: any) {
  const startedAt = Date.now()
  const { projectId, targetLangs, jobId } = job.data as { projectId: string; targetLangs: string[]; jobId: string }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.VOICE)
  emitJobProgress({ projectId, kind: JobKind.VOICE, status: JobStatus.RUNNING, progress: 0 })
  const langProgress: Record<string, number> = {}
  const tts = Providers.tts()
  for (const lang of targetLangs) {
    const translation = await translationRepo.findByProjectAndLang(projectId, lang)
    const segments: SegmentTiming[] = translation?.segments || [
      { start: 0, end: 2.4, text: 'Hello world' },
      { start: 2.4, end: 5.1, text: 'Sample transcription' }
    ]
    const block = await tts.synthesizeLanguage(projectId, lang, segments, (p) => {
      langProgress[lang] = p
      const overall = Math.floor(Object.values(langProgress).reduce((a, b) => a + b, 0) / (targetLangs.length || 1))
      jobRepo.setProgress(jobId, overall).catch(() => {})
      emitJobProgress({ projectId, kind: JobKind.VOICE, status: JobStatus.RUNNING, progress: overall })
    })
    await mediaRepo.insert({ id: randomUUID(), projectId, type: 'DUB_AUDIO', url: block.audioPath, meta: { lang, duration: block.duration } })
  }
  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.VOICE, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.VOICE, status: JobStatus.DONE, progress: 100 })
  return { projectId, voiced: targetLangs }
}

export const voiceWorker = new Worker(JobKind.VOICE, processVoice, { connection })

voiceWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    emitJobProgress({ projectId: data.projectId, kind: JobKind.VOICE, status: JobStatus.ERROR, progress: 0, error: err.message })
    recordJobEnd(JobKind.VOICE, 0, false)
  }
})
