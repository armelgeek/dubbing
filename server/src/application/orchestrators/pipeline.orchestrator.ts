import { JobKind } from '../../../../shared/src/types/job'
import { JobRepository } from '../../infrastructure/repositories/job.repository'

interface Queues {
  add(kind: JobKind, data: Record<string, any>, opts?: { delay?: number }): Promise<void>
}

export class PipelineOrchestrator {
  private jobRepo = new JobRepository()
  constructor(private readonly queueDispatcher: Queues) {}

  async start(projectId: string, targetLangs: string[]) {
    const kinds: JobKind[] = [
      JobKind.TRANSCRIBE,
      JobKind.TRANSLATE,
      JobKind.VOICE,
      ...(process.env.ENABLE_LIPSYNC === 'true' ? [JobKind.LIPSYNC] : []),
      JobKind.MUX
    ]
    for (const kind of kinds) {
      const jobId = `${projectId}:${kind}`
      await this.jobRepo.upsert({ id: jobId, projectId, kind })
    }
    await this.queueDispatcher.add(JobKind.TRANSCRIBE, { projectId, jobId: `${projectId}:${JobKind.TRANSCRIBE}` })
    await this.queueDispatcher.add(JobKind.TRANSLATE, { projectId, targetLangs, jobId: `${projectId}:${JobKind.TRANSLATE}` }, { delay: 500 })
    await this.queueDispatcher.add(JobKind.VOICE, { projectId, targetLangs, jobId: `${projectId}:${JobKind.VOICE}` }, { delay: 1000 })
    if (process.env.ENABLE_LIPSYNC === 'true') {
      await this.queueDispatcher.add(JobKind.LIPSYNC, { projectId, targetLangs, jobId: `${projectId}:${JobKind.LIPSYNC}` }, { delay: 1500 })
    }
    await this.queueDispatcher.add(JobKind.MUX, { projectId, targetLangs, jobId: `${projectId}:${JobKind.MUX}` }, { delay: 2000 })
  }
}
