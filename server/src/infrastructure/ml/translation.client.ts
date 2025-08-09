import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface TranslationOutput {
  lang: string
  segments: Array<SegmentTiming & { translatedText: string }>
}

export class TranslationClient {
  constructor(private provider: 'nllb' | 'marian' | 'argos' = 'marian') {}

  async translateSegments(base: { segments: SegmentTiming[]; sourceLang: string; targetLangs: string[] }, onLangProgress?: (lang: string, p: number) => void): Promise<TranslationOutput[]> {
    const outputs: TranslationOutput[] = []
    for (const lang of base.targetLangs) {
      for (let p = 0; p <= 100; p += 25) {
        await new Promise(r => setTimeout(r, 10))
        onLangProgress?.(lang, p)
      }
      outputs.push({
        lang,
        segments: base.segments.map(s => ({ ...s, translatedText: `[${lang}] ${s.text}` }))
      })
    }
    return outputs
  }
}

export const translationClient = new TranslationClient(process.env.TRANSLATION_PROVIDER as any)
