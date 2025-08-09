import { Queue } from 'bullmq'
import { JobKind } from '../../../../shared/src/types/job'

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' }

const defaultJobOpts = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 500 }
}

export const queues: Record<JobKind, Queue> = {
  [JobKind.TRANSCRIBE]: new Queue(JobKind.TRANSCRIBE, { connection, defaultJobOptions: defaultJobOpts }),
  [JobKind.TRANSLATE]: new Queue(JobKind.TRANSLATE, { connection, defaultJobOptions: defaultJobOpts }),
  [JobKind.VOICE]: new Queue(JobKind.VOICE, { connection, defaultJobOptions: defaultJobOpts }),
  [JobKind.LIPSYNC]: new Queue(JobKind.LIPSYNC, { connection, defaultJobOptions: defaultJobOpts }),
  [JobKind.MUX]: new Queue(JobKind.MUX, { connection, defaultJobOptions: defaultJobOpts })
}

export const queueDispatcher = {
  async add(kind: JobKind, data: Record<string, any>, opts?: { delay?: number; attempts?: number }) {
    await queues[kind].add(kind, data, { delay: opts?.delay, attempts: opts?.attempts })
  }
}
