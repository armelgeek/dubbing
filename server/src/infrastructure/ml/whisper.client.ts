import process from 'node:process'
// Minimal whisper client wrapper (open-source friendly)
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface TranscriptionResult {
  language: string
  segments: SegmentTiming[]
}

const SIMULATED_SEGMENTS: SegmentTiming[] = [
  { start: 6, end: 16, text: 'thank you very' },
  { start: 16, end: 18, text: 'much I am' },
  { start: 18, end: 22, text: 'particularly proud and happy about the' },
  { start: 22, end: 27, text: 'young filmmakers actors singers writers' },
  { start: 27, end: 30, text: 'producers that are coming up' },
  { start: 31, end: 37, text: 'behind my generation in particular Barry' },
  { start: 37, end: 39, text: 'Jenkins young people understand this' },
  { start: 39, end: 44, text: 'young man made 10 15 20 short films' },
  { start: 44, end: 47, text: 'before he got the opportunity to make' },
  { start: 47, end: 49, text: 'moonlight so never give' },
  { start: 49, end: 51, text: 'up without' },
  { start: 51, end: 54, text: "commitment you'll never start but more" },
  { start: 54, end: 56, text: 'importantly without' },
  { start: 56, end: 60, text: "consistency you'll never finish it's not" },
  { start: 60, end: 61, text: 'easy' },
  { start: 61, end: 63, text: "if it was easy there'd be no Carrie" },
  { start: 63, end: 66, text: "Washington if it was easy there'd be no" },
  { start: 66, end: 68, text: 'taji Henson P' },
  { start: 70, end: 72, text: "Henson if it were easy there'd be no" },
  { start: 72, end: 75, text: 'Octavia Spencer but not only that if it' },
  { start: 75, end: 77, text: "were easy there'd be no Biola Davis if" },
  { start: 77, end: 80, text: "it were easy there'd be no Michael T" },
  { start: 80, end: 82, text: 'Williamson no Steven mckenley Henderson' },
  { start: 82, end: 86, text: "no Russell Hornsby if were easy there'd" },
  { start: 86, end: 88, text: 'be no Denzel Washington' },
  { start: 88, end: 91, text: 'so keep working' },
  { start: 91, end: 93, text: 'keep striving never give up fall down' },
  { start: 93, end: 94, text: 'seven times get up' },
  { start: 97, end: 99, text: 'eight' },
  { start: 99, end: 104, text: 'ease is a greater threat to' },
  { start: 104, end: 108, text: 'progress than' },
  { start: 108, end: 110, text: 'hardship ease is a greater threat to' },
  { start: 110, end: 114, text: 'progress than hardship so keep moving' },
  { start: 114, end: 116, text: 'keep growing keep learning see you at' },
  { start: 116, end: 118, text: 'work' },
]

export class WhisperClient {
  constructor(private impl: 'faster-whisper' | 'whisper.cpp' = 'faster-whisper') {}

  async transcribe(audioPath: string, onProgress?: (p: number) => void): Promise<TranscriptionResult> {
    for (let p = 0; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 30))
      onProgress?.(p)
    }
    return { language: 'en', segments: SIMULATED_SEGMENTS }
  }
}

export const whisperClient = new WhisperClient(process.env.WHISPER_IMPLEMENTATION as any)
