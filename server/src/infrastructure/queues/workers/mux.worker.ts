import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { Worker } from 'bullmq'
import { JobKind, JobStatus } from '../../../../../shared/src/types/job'
import { muxDubbedVideo } from '../../../infrastructure/media/ffmpeg-muxer'
import { recordJobEnd, recordJobStart } from '../../../infrastructure/metrics/metrics.registry'
import { emitJobProgress } from '../../../infrastructure/realtime/progress-emitter'
import { JobRepository } from '../../../infrastructure/repositories/job.repository'
import { MediaAssetRepository } from '../../../infrastructure/repositories/media-asset.repository'
import { ProjectRepository } from '../../../infrastructure/repositories/project.repository'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }
const jobRepo = new JobRepository()
const mediaRepo = new MediaAssetRepository()
const projectRepo = new ProjectRepository()

async function processMux(job: any) {
  const startedAt = Date.now()
  const { projectId, jobId, skipVoice } = job.data as { projectId: string; jobId: string; skipVoice?: boolean }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.MUX)
  emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.RUNNING, progress: 0 })

  const source = await mediaRepo.findByType(projectId, 'SOURCE_VIDEO')
  const allAssets = await mediaRepo.listForProject(projectId)
  const dubAudios = allAssets.filter((a: any) => a.type === 'DUB_AUDIO')
  const subtitles = allAssets.filter((a: any) => a.type === 'SUBTITLE_SRT' || a.type === 'SUBTITLE_VTT')

  if (!source?.url) {
    throw new Error('No SOURCE_VIDEO found for mux')
  }

  // In subtitle-only mode, we don't need dub audio
  if (!skipVoice && dubAudios.length === 0) {
    throw new Error('No DUB_AUDIO tracks found for mux')
  }

  // If skipVoice is true, generate video with embedded subtitles only
  if (skipVoice) {
    const subtitlesByLang = new Map<string, any>()
    for (const sub of subtitles) {
      const lang = sub.meta?.lang
      if (lang && sub.type === 'SUBTITLE_SRT') {
        subtitlesByLang.set(lang, sub)
      }
    }

    const total = Math.max(subtitlesByLang.size, 1)
    let done = 0

    for (const [lang, subtitle] of subtitlesByLang) {
      const key = `final-videos/${projectId}/${lang}/${randomUUID()}.mp4`

      const stored = await muxDubbedVideo({
        sourceUrl: source.url,
        subtitleUrl: subtitle.url,
        outKey: key,
        meta: { projectId, lang, source: source.url, subtitle: subtitle.url }
      })

      await mediaRepo.insert({
        id: randomUUID(),
        projectId,
        type: 'FINAL_VIDEO',
        url: stored.url,
        meta: { lang, source: source.url, subtitle: subtitle.url, subtitleOnly: true }
      })
      done += 1
      const p = Math.round((done / total) * 100)
      await jobRepo.setProgress(jobId, p).catch(() => {})
      emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.RUNNING, progress: p })
    }
  } else {
    // Original logic with audio dubbing
    const total = Math.max(dubAudios.length, 1)
    let done = 0

    for (const dub of dubAudios) {
      const lang = dub.meta?.lang || 'unknown'
      const key = `final-videos/${projectId}/${lang}/${randomUUID()}.mp4`

      // Find matching subtitle if available
      const subtitle = subtitles.find((s: any) => s.meta?.lang === lang && s.type === 'SUBTITLE_SRT')

      const stored = await muxDubbedVideo({
        sourceUrl: source.url,
        audioUrl: dub.url,
        subtitleUrl: subtitle?.url,
        outKey: key,
        meta: { projectId, lang, source: source.url, dubAudio: dub.url }
      })

      await mediaRepo.insert({
        id: randomUUID(),
        projectId,
        type: 'FINAL_VIDEO',
        url: stored.url,
        meta: { lang, source: source.url, dubAudio: dub.url, subtitle: subtitle?.url }
      })
      done += 1
      const p = Math.round((done / total) * 100)
      await jobRepo.setProgress(jobId, p).catch(() => {})
      emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.RUNNING, progress: p })
    }
  }

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
    emitJobProgress({
      projectId: data.projectId,
      kind: JobKind.MUX,
      status: JobStatus.ERROR,
      progress: 0,
      error: err.message
    })
  }
})
