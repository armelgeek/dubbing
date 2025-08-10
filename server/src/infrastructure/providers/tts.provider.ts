import { ttsClient } from '../ml/tts.client'
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface SynthesizedAudioMeta {
  audioPath: string
  duration: number
  segmentCount: number
  lang: string
}

export interface TTSProvider {
  id: string
  synthesizeLanguage: (
    projectId: string,
    lang: string,
    segments: SegmentTiming[],
    onProgress?: (p: number) => void
  ) => Promise<SynthesizedAudioMeta>
}

class LocalXTTSProvider implements TTSProvider {
  id = 'local-xtts'
  async synthesizeLanguage(
    projectId: string,
    lang: string,
    segments: SegmentTiming[],
    onProgress?: (p: number) => void
  ): Promise<SynthesizedAudioMeta> {
    const block = await ttsClient.synthesizeLanguage(projectId, lang, segments, onProgress)
    return { audioPath: block.audioPath, duration: block.duration, segmentCount: block.segmentCount, lang }
  }
}

export const ttsProvider: TTSProvider = new LocalXTTSProvider()
