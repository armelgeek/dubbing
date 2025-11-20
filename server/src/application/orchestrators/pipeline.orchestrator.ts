import { JobKind } from '../../../../shared/src/types/job'
import { JobRepository } from '../../infrastructure/repositories/job.repository'

interface Queues {
  add(kind: JobKind, data: Record<string, any>, opts?: { delay?: number }): Promise<void>
}

export class PipelineOrchestrator {
  private jobRepo = new JobRepository()
  constructor(private readonly queueDispatcher: Queues) {}

  async start(projectId: string, targetLangs: string[], options?: { skipVoice?: boolean }) {
    const skipVoice = options?.skipVoice || process.env.SKIP_VOICE === 'true'
    
    const kinds: JobKind[] = [
      JobKind.TRANSCRIBE,
      JobKind.TRANSLATE,
      JobKind.SUBTITLE,
      ...(skipVoice ? [] : [JobKind.VOICE]),
      ...(process.env.ENABLE_LIPSYNC === 'true' && !skipVoice ? [JobKind.LIPSYNC] : []),
      JobKind.MUX
    ]
    for (const kind of kinds) {
      const jobId = `${projectId}:${kind}`
      await this.jobRepo.upsert({ id: jobId, projectId, kind })
    }
    await this.queueDispatcher.add(JobKind.TRANSCRIBE, { projectId, jobId: `${projectId}:${JobKind.TRANSCRIBE}` })
    await this.queueDispatcher.add(JobKind.TRANSLATE, { projectId, targetLangs, jobId: `${projectId}:${JobKind.TRANSLATE}` }, { delay: 500 })
    await this.queueDispatcher.add(JobKind.SUBTITLE, { projectId, targetLangs, jobId: `${projectId}:${JobKind.SUBTITLE}` }, { delay: 1000 })
    
    if (!skipVoice) {
      await this.queueDispatcher.add(JobKind.VOICE, { projectId, targetLangs, jobId: `${projectId}:${JobKind.VOICE}` }, { delay: 1500 })
      if (process.env.ENABLE_LIPSYNC === 'true') {
        await this.queueDispatcher.add(JobKind.LIPSYNC, { projectId, targetLangs, jobId: `${projectId}:${JobKind.LIPSYNC}` }, { delay: 2000 })
      }
    }
    
    const muxDelay = skipVoice ? 1500 : (process.env.ENABLE_LIPSYNC === 'true' ? 2500 : 2000)
    await this.queueDispatcher.add(JobKind.MUX, { projectId, targetLangs, skipVoice, jobId: `${projectId}:${JobKind.MUX}` }, { delay: muxDelay })
  }
}
