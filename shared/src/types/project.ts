// Project related shared types
import { JobKind, JobStatus } from './job'
import type { JobProgressEvent, SegmentTiming, TranslationSegment } from './job'
import type { MediaAssetRecord } from './media'

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface ProjectRecord {
  id: string
  userId: string
  title: string
  sourceVideoUrl?: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  meta?: Record<string, any>
}

export interface ProjectDetail extends ProjectRecord {
  jobs: Array<{
    id: string
    kind: JobKind
    status: JobStatus
    progress: number
  }>
  assets: MediaAssetRecord[]
}

export interface CreateProjectDTO {
  title: string
  sourceType: 'upload' | 'youtube'
  youtubeUrl?: string
}

export interface ProjectProgressStreamPayload extends JobProgressEvent {}

export interface TranscriptPayload {
  segments: SegmentTiming[]
  language: string
}

export interface TranslationPayload {
  language: string
  segments: TranslationSegment[]
}
