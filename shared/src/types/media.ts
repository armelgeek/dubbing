// Media related shared types

export enum MediaAssetType {
  SOURCE_VIDEO = 'SOURCE_VIDEO',
  SOURCE_AUDIO = 'SOURCE_AUDIO',
  TRANSCRIPT_JSON = 'TRANSCRIPT_JSON',
  TRANSLATION_JSON = 'TRANSLATION_JSON',
  DUB_AUDIO = 'DUB_AUDIO',
  PREVIEW_VIDEO = 'PREVIEW_VIDEO',
  FINAL_VIDEO = 'FINAL_VIDEO',
  TIMING_JSON = 'TIMING_JSON'
}

export interface MediaAssetMeta {
  durationSeconds?: number
  lang?: string
  mime?: string
  sizeBytes?: number
  hash?: string
  waveformSamples?: number[]
  speakers?: number
  segmentCount?: number
  version?: number
  [k: string]: any
}

export interface MediaAssetRecord {
  id: string
  projectId: string
  type: MediaAssetType
  url: string
  meta: MediaAssetMeta
  createdAt: string
  updatedAt: string
}
