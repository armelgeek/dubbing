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
  const { projectId, jobId } = job.data as { projectId: string; jobId: string }
  await jobRepo.setRunning(jobId)
  recordJobStart(JobKind.MUX)
  emitJobProgress({ projectId, kind: JobKind.MUX, status: JobStatus.RUNNING, progress: 0 })

  const source = await mediaRepo.findByType(projectId, 'SOURCE_VIDEO')
  const allAssets = await mediaRepo.listForProject(projectId)
  const dubAudios = allAssets.filter((a: any) => a.type === 'DUB_AUDIO')

  const total = Math.max(dubAudios.length, 1)
  let done = 0

  if (!source?.url) {
    throw new Error('No SOURCE_VIDEO found for mux')
  }

  if (dubAudios.length === 0) {
    throw new Error('No DUB_AUDIO tracks found for mux')
  } else {
    for (const dub of dubAudios) {
      const lang = dub.meta?.lang || 'unknown'
      const key = `final-videos/${projectId}/${lang}/${randomUUID()}.mp4`

      const stored = await muxDubbedVideo({
        sourceUrl: source.url,
        audioUrl: dub.url,
        outKey: key,
        meta: { projectId, lang, source: source.url, dubAudio: dub.url }
      })

      await mediaRepo.insert({
        id: randomUUID(),
        projectId,
        type: 'FINAL_VIDEO',
        url: stored.url,
        meta: { lang, source: source.url, dubAudio: dub.url }
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
