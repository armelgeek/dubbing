import type { SegmentTiming } from '../../../../shared/src/types/job'
import { translationClient } from '../ml/translation.client'

export interface TranslationSegment extends SegmentTiming { translatedText: string }
export interface TranslationLanguageResult { lang: string; segments: TranslationSegment[] }

export interface TranslationProvider {
  id: string
  translate(input: { segments: SegmentTiming[]; sourceLang: string; targetLangs: string[] }, onProgress?: (lang: string, p: number) => void): Promise<TranslationLanguageResult[]>
}

class LocalTranslationProvider implements TranslationProvider {
  id = 'local-translation'
  async translate(input: { segments: SegmentTiming[]; sourceLang: string; targetLangs: string[] }, onProgress?: (lang: string, p: number) => void): Promise<TranslationLanguageResult[]> {
    const outputs = await translationClient.translateSegments({ segments: input.segments, sourceLang: input.sourceLang, targetLangs: input.targetLangs }, onProgress)
    return outputs.map(o => ({ lang: o.lang, segments: o.segments }))
  }
}

export const translationProvider: TranslationProvider = new LocalTranslationProvider()
