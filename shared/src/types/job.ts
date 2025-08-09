// Job related shared types (pipeline video dubbing)

export enum JobKind {
  TRANSCRIBE = 'TRANSCRIBE',
  TRANSLATE = 'TRANSLATE',
  VOICE = 'VOICE',
  LIPSYNC = 'LIPSYNC',
  MUX = 'MUX'
}

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  ERROR = 'ERROR'
}

export interface JobRecord {
  id: string
  projectId: string
  kind: JobKind
  status: JobStatus
  progress: number // 0-100
  error?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

export interface JobProgressEvent {
  projectId: string
  jobId?: string
  kind: JobKind
  status: JobStatus
  progress: number
  error?: string
  timestamp: string
}

export interface StartPipelineDTO {
  projectId: string
  targetLangs: string[]
}

export interface SegmentTiming {
  start: number // seconds
  end: number // seconds
  text: string
  speaker?: string
}

export interface TranslationSegment extends SegmentTiming {
  lang: string
  translatedText: string
}
