import type { JobProgressEvent } from '../../../../shared/src/types/job'

export const ProjectEvents = {
  PROJECT_CREATED: 'project.created',
  PIPELINE_STARTED: 'pipeline.started',
  JOB_PROGRESS: 'job.progress',
  PROJECT_READY: 'project.ready',
  PROJECT_ERROR: 'project.error'
} as const

export type ProjectEventName = typeof ProjectEvents[keyof typeof ProjectEvents]

export interface ProjectCreatedEvent {
  name: typeof ProjectEvents.PROJECT_CREATED
  projectId: string
  userId: string
  timestamp: string
}

export interface JobProgressInternalEvent extends JobProgressEvent {
  name: typeof ProjectEvents.JOB_PROGRESS
}

export interface ProjectReadyEvent {
  name: typeof ProjectEvents.PROJECT_READY
  projectId: string
  timestamp: string
}

export interface ProjectErrorEvent {
  name: typeof ProjectEvents.PROJECT_ERROR
  projectId: string
  error: string
  timestamp: string
}

export type AnyProjectDomainEvent =
  | ProjectCreatedEvent
  | JobProgressInternalEvent
  | ProjectReadyEvent
  | ProjectErrorEvent

export function makeJobProgressEvent(data: Omit<JobProgressInternalEvent, 'name'>): JobProgressInternalEvent {
  return { ...data, name: ProjectEvents.JOB_PROGRESS }
}

export function makeProjectReadyEvent(projectId: string): ProjectReadyEvent {
  return { name: ProjectEvents.PROJECT_READY, projectId, timestamp: new Date().toISOString() }
}

export function makeProjectErrorEvent(projectId: string, error: string): ProjectErrorEvent {
  return { name: ProjectEvents.PROJECT_ERROR, projectId, error, timestamp: new Date().toISOString() }
}
