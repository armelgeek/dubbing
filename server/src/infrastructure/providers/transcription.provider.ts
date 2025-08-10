import { whisperClient } from '../ml/whisper.client'
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface TranscriptionResult {
  language: string
  segments: SegmentTiming[]
}

export interface TranscriptionProvider {
  id: string
  transcribe: (audioPath: string, onProgress?: (p: number) => void) => Promise<TranscriptionResult>
}

class LocalWhisperTranscriptionProvider implements TranscriptionProvider {
  id = 'local-whisper'
  async transcribe(audioPath: string, onProgress?: (p: number) => void): Promise<TranscriptionResult> {
    const r = await whisperClient.transcribe(audioPath, onProgress)
    return { language: r.language, segments: r.segments }
  }
}

export const transcriptionProvider: TranscriptionProvider = new LocalWhisperTranscriptionProvider()
