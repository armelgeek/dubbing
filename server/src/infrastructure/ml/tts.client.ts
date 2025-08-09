import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface SynthesizedBlock {
  lang: string
  audioPath: string
  duration: number
  segmentCount: number
}

export class TTSClient {
  constructor(private provider: 'coqui' | 'piper' | 'bark' = 'coqui') {}

  async synthesizeLanguage(projectId: string, lang: string, segments: SegmentTiming[], onProgress?: (p: number) => void): Promise<SynthesizedBlock> {
    for (let p = 0; p <= 100; p += 20) {
      await new Promise(r => setTimeout(r, 15))
      onProgress?.(p)
    }
    return {
      lang,
      audioPath: `/tmp/${projectId}_${lang}.wav`,
      duration: segments.reduce((acc, s) => acc + (s.end - s.start), 0),
      segmentCount: segments.length
    }
  }
}

export const ttsClient = new TTSClient(process.env.TTS_PROVIDER as any)
