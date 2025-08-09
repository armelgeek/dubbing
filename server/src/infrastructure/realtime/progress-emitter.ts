import { broadcastProgress } from './ws.gateway'
import { JobStatus, type JobProgressEvent, JobKind } from '../../../../shared/src/types/job'

export function emitJobProgress(partial: Omit<JobProgressEvent, 'timestamp'>) {
  const ev: JobProgressEvent = { ...partial, timestamp: new Date().toISOString() }
  broadcastProgress(ev)
}

export function emitSimpleProgress(projectId: string, kind: JobKind, progress: number, status: JobStatus) {
  emitJobProgress({ projectId, kind, progress, status })
}
