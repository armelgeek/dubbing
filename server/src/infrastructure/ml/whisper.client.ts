// Minimal whisper client wrapper (open-source friendly)
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface TranscriptionResult {
  language: string
  segments: SegmentTiming[]
}

export class WhisperClient {
  constructor(private impl: 'faster-whisper' | 'whisper.cpp' = 'faster-whisper') {}

  async transcribe(audioPath: string, onProgress?: (p: number) => void): Promise<TranscriptionResult> {
    // Placeholder stub: integrate python service over HTTP or CLI call
    // Simulate progress
    for (let p = 0; p <= 100; p += 20) {
      await new Promise(r => setTimeout(r, 30))
      onProgress?.(p)
    }
    return {
      language: 'en',
      segments: [
        { start: 0, end: 2.4, text: 'Hello world' },
        { start: 2.4, end: 5.1, text: 'Sample transcription' }
      ]
    }
  }
}

export const whisperClient = new WhisperClient(process.env.WHISPER_IMPLEMENTATION as any)
