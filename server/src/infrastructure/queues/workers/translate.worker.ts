import { Worker } from 'bullmq'
import { JobKind, JobStatus, type SegmentTiming } from '../../../../../shared/src/types/job'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { TranscriptRepository } from '../../../infrastructure/repositories/transcript.repository'
import { TranslationRepository } from '../../../infrastructure/repositories/translation.repository'
import { randomUUID } from 'crypto'
import { Providers } from '../../../infrastructure/providers/provider.factory'
import { recordJobStart, recordJobEnd } from '../../../infrastructure/metrics/metrics.registry'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const transcriptRepo = new TranscriptRepository()
const translationRepo = new TranslationRepository()

async function processTranslate(job: any) {
  const startedAt = Date.now()
  const { projectId, targetLangs, jobId } = job.data as { projectId: string; targetLangs: string[]; jobId: string }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.TRANSLATE)
  emitJobProgress({ projectId, kind: JobKind.TRANSLATE, status: JobStatus.RUNNING, progress: 0 })
  const baseTranscript = await transcriptRepo.findByProjectAndLanguage(projectId, 'en')
  const baseSegments: SegmentTiming[] = baseTranscript?.segments || [
    { start: 0, end: 2.4, text: 'Hello world' },
    { start: 2.4, end: 5.1, text: 'Sample transcription' }
  ]
  const perLangProgress: Record<string, number> = {}
  const translationProv = Providers.translation()
  const results = await translationProv.translate({ segments: baseSegments, sourceLang: 'en', targetLangs }, (lang, p) => {
    perLangProgress[lang] = p
    const overall = Math.floor(Object.values(perLangProgress).reduce((a, b) => a + b, 0) / (targetLangs.length || 1))
    jobRepo.setProgress(jobId, overall).catch(() => {})
    emitJobProgress({ projectId, kind: JobKind.TRANSLATE, status: JobStatus.RUNNING, progress: overall })
  })
  for (const res of results) {
    await translationRepo.insert({ id: randomUUID(), projectId, lang: res.lang, segments: res.segments })
  }
  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.TRANSLATE, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.TRANSLATE, status: JobStatus.DONE, progress: 100 })
  return { projectId, translated: targetLangs }
}

export const translateWorker = new Worker(JobKind.TRANSLATE, processTranslate, { connection })

translateWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    emitJobProgress({ projectId: data.projectId, kind: JobKind.TRANSLATE, status: JobStatus.ERROR, progress: 0, error: err.message })
    recordJobEnd(JobKind.TRANSLATE, 0, false)
  }
})
