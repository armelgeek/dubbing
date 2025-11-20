import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { Worker } from 'bullmq'
import { JobKind, JobStatus } from '../../../../../shared/src/types/job'
import { recordJobEnd, recordJobStart } from '../../../infrastructure/metrics/metrics.registry'
import { Providers } from '../../../infrastructure/providers/provider.factory'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { MediaAssetRepository } from '../../../infrastructure/repositories/media-asset.repository'
import { TranslationRepository } from '../../../infrastructure/repositories/translation.repository'
import { generateSRT, generateVTT } from '../../util/subtitle-generator'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const translationRepo = new TranslationRepository()
const mediaRepo = new MediaAssetRepository()

const ASSETS_BASE_DIR = process.env.ASSETS_BASE_DIR || '/tmp/dubbing-assets'

async function processSubtitle(job: any) {
  const startedAt = Date.now()
  const { projectId, targetLangs, jobId } = job.data as { projectId: string; targetLangs: string[]; jobId: string }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.SUBTITLE)
  emitJobProgress({ projectId, kind: JobKind.SUBTITLE, status: JobStatus.RUNNING, progress: 0 })

  const total = targetLangs.length
  let done = 0

  for (const lang of targetLangs) {
    const translation = await translationRepo.findByProjectAndLang(projectId, lang)

    if (!translation || !translation.segments || translation.segments.length === 0) {
      console.warn(`No translation found for language ${lang}, skipping subtitle generation`)
      done++
      continue
    }

    const segments = translation.segments

    // Generate SRT
    const srtContent = generateSRT(segments)
    const srtKey = `subtitles/${projectId}/${lang}/${randomUUID()}.srt`
    const srtPath = join(ASSETS_BASE_DIR, srtKey)
    mkdirSync(dirname(srtPath), { recursive: true })
    writeFileSync(srtPath, srtContent, 'utf-8')

    const storage = Providers.storage()
    const srtStored = await storage.put(srtKey, Buffer.from(srtContent, 'utf-8'), {
      originalName: `${lang}.srt`,
      type: 'text/plain'
    })

    await mediaRepo.insert({
      id: randomUUID(),
      projectId,
      type: 'SUBTITLE_SRT',
      url: srtStored.url,
      meta: { lang, format: 'srt', segmentCount: segments.length }
    })

    // Generate VTT
    const vttContent = generateVTT(segments)
    const vttKey = `subtitles/${projectId}/${lang}/${randomUUID()}.vtt`
    const vttPath = join(ASSETS_BASE_DIR, vttKey)
    mkdirSync(dirname(vttPath), { recursive: true })
    writeFileSync(vttPath, vttContent, 'utf-8')

    const vttStored = await storage.put(vttKey, Buffer.from(vttContent, 'utf-8'), {
      originalName: `${lang}.vtt`,
      type: 'text/vtt'
    })

    await mediaRepo.insert({
      id: randomUUID(),
      projectId,
      type: 'SUBTITLE_VTT',
      url: vttStored.url,
      meta: { lang, format: 'vtt', segmentCount: segments.length }
    })

    done++
    const progress = Math.floor((done / total) * 100)
    await jobRepo.setProgress(jobId, progress).catch(() => {})
    emitJobProgress({ projectId, kind: JobKind.SUBTITLE, status: JobStatus.RUNNING, progress })
  }

  await jobRepo.setDone(jobId)
  recordJobEnd(JobKind.SUBTITLE, Date.now() - startedAt, true)
  emitJobProgress({ projectId, kind: JobKind.SUBTITLE, status: JobStatus.DONE, progress: 100 })
  return { projectId, subtitles: targetLangs }
}

export const subtitleWorker = new Worker(JobKind.SUBTITLE, processSubtitle, { connection })

subtitleWorker.on('failed', (job, err) => {
  const data = job?.data
  if (data?.projectId && data?.jobId) {
    jobRepo.setError(data.jobId, err.message).catch(() => {})
    emitJobProgress({
      projectId: data.projectId,
      kind: JobKind.SUBTITLE,
      status: JobStatus.ERROR,
      progress: 0,
      error: err.message
    })
    recordJobEnd(JobKind.SUBTITLE, 0, false)
  }
})
