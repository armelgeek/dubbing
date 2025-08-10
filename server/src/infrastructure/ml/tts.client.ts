import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { Providers } from '../providers/provider.factory'
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface SynthesizedBlock {
  lang: string
  audioPath: string
  duration: number
  segmentCount: number
}

function createSilentWav(seconds: number, sampleRate = 16000): Buffer {
  const sr = Math.max(8000, Math.floor(sampleRate))
  const numSamples = Math.max(0, Math.floor(Math.max(0, seconds) * sr))
  const headerSize = 44
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(headerSize + dataSize)

  let o = 0
  buffer.write('RIFF', o)
  o += 4
  buffer.writeUInt32LE(36 + dataSize, o)
  o += 4
  buffer.write('WAVE', o)
  o += 4
  buffer.write('fmt ', o)
  o += 4
  buffer.writeUInt32LE(16, o)
  o += 4
  buffer.writeUInt16LE(1, o)
  o += 2
  buffer.writeUInt16LE(1, o)
  o += 2
  buffer.writeUInt32LE(sr, o)
  o += 4
  buffer.writeUInt32LE(sr * 2, o)
  o += 4
  buffer.writeUInt16LE(2, o)
  o += 2
  buffer.writeUInt16LE(16, o)
  o += 2
  buffer.write('data', o)
  o += 4
  buffer.writeUInt32LE(dataSize, o)
  // Data is already zeroed (silence)

  return buffer
}

export class TTSClient {
  constructor(private provider: 'coqui' | 'piper' | 'bark' = 'coqui') {}

  async synthesizeLanguage(
    projectId: string,
    lang: string,
    segments: SegmentTiming[],
    onProgress?: (p: number) => void
  ): Promise<SynthesizedBlock> {
    for (let p = 0; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 15))
      onProgress?.(p)
    }

    const duration = Math.max(
      0,
      segments.reduce((acc, s) => acc + (s.end - s.start), 0)
    )
    const segmentCount = segments.length

    const key = `dub-audio/${projectId}/${lang}/${randomUUID()}.wav`
    const buf = createSilentWav(duration, 16000)
    const stored = await Providers.storage().put(key, buf, { projectId, lang, duration, segmentCount })

    return {
      lang,
      audioPath: stored.url,
      duration,
      segmentCount
    }
  }
}

export const ttsClient = new TTSClient(process.env.TTS_PROVIDER as any)
