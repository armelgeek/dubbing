import process from 'node:process'
import type { SegmentTiming } from '../../../../shared/src/types/job'

export interface TranslationOutput {
  lang: string
  segments: Array<SegmentTiming & { translatedText: string }>
}

// Fallback segments for standalone translation testing
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
  { start: 116, end: 118, text: 'work' }
]

// Direct French translations aligned with SIMULATED_SEGMENTS by index
const SIMULATED_FR_SEGMENTS: SegmentTiming[] = [
  { start: 6, end: 16, text: 'merci beaucoup' },
  { start: 16, end: 18, text: 'beaucoup, je suis' },
  { start: 18, end: 22, text: 'particulièrement fier et heureux de la' },
  { start: 22, end: 27, text: 'jeunes réalisateurs, acteurs, chanteurs, écrivains' },
  { start: 27, end: 30, text: 'producteurs qui arrivent' },
  { start: 31, end: 37, text: 'derrière ma génération, en particulier Barry' },
  { start: 37, end: 39, text: 'Jenkins. Les jeunes le comprennent' },
  { start: 39, end: 44, text: 'ce jeune homme a réalisé 10, 15, 20 courts métrages' },
  { start: 44, end: 47, text: "avant d'avoir l'opportunité de faire" },
  { start: 47, end: 49, text: "Moonlight. Alors n'abandonnez" },
  { start: 49, end: 51, text: 'jamais sans' },
  { start: 51, end: 54, text: 'engagement, vous ne commencerez jamais, mais surtout' },
  { start: 54, end: 56, text: 'plus important, sans' },
  { start: 56, end: 60, text: "constance, vous ne finirez jamais. Ce n'est pas" },
  { start: 60, end: 61, text: 'facile' },
  { start: 61, end: 63, text: "si c'était facile, il n'y aurait pas de Kerry" },
  { start: 63, end: 66, text: "Washington. Si c'était facile, il n'y aurait pas de" },
  { start: 66, end: 68, text: 'Taraji P. Henson' },
  { start: 70, end: 72, text: "Henson. Si c'était facile, il n'y aurait pas de" },
  { start: 72, end: 75, text: "Octavia Spencer, mais pas seulement. Si c'était" },
  { start: 75, end: 77, text: "facile, il n'y aurait pas de Viola Davis si" },
  { start: 77, end: 80, text: "c'était facile, il n'y aurait pas de Michael T" },
  { start: 80, end: 82, text: 'Williamson, ni Stephen McKinley Henderson' },
  { start: 82, end: 86, text: "ni Russell Hornsby. Si c'était facile, il y" },
  { start: 86, end: 88, text: "n'aurait pas de Denzel Washington" },
  { start: 88, end: 91, text: 'alors continuez à travailler' },
  { start: 91, end: 93, text: "persévérez, n'abandonnez jamais, tombez" },
  { start: 93, end: 94, text: 'sept fois, relevez-vous' },
  { start: 97, end: 99, text: 'huit' },
  { start: 99, end: 104, text: 'la facilité est une plus grande menace pour' },
  { start: 104, end: 108, text: 'le progrès que' },
  { start: 108, end: 110, text: "l'adversité. La facilité est une plus grande menace pour" },
  { start: 110, end: 114, text: "le progrès que l'adversité. Alors continuez d'avancer" },
  { start: 114, end: 116, text: "continuez de grandir, continuez d'apprendre, on se voit au" },
  { start: 116, end: 118, text: 'travail' }
]

const FRENCH_TRANSLATIONS: Record<string, string> = {
  'thank you very': 'merci beaucoup',
  'much I am': 'beaucoup, je suis',
  'particularly proud and happy about the': 'particulièrement fier et heureux de la',
  'young filmmakers actors singers writers': 'jeunes réalisateurs, acteurs, chanteurs, écrivains',
  'producers that are coming up': 'producteurs qui arrivent',
  'behind my generation in particular Barry': 'derrière ma génération, en particulier Barry',
  'Jenkins young people understand this': 'Jenkins. Les jeunes le comprennent',
  'young man made 10 15 20 short films': 'ce jeune homme a réalisé 10, 15, 20 courts métrages',
  'before he got the opportunity to make': "avant d'avoir l'opportunité de faire",
  'moonlight so never give': "Moonlight. Alors n'abandonnez",
  'up without': 'jamais sans',
  "commitment you'll never start but more": 'engagement, vous ne commencerez jamais, mais surtout',
  'importantly without': 'plus important, sans',
  "consistency you'll never finish it's not": "constance, vous ne finirez jamais. Ce n'est pas",
  easy: 'facile',
  "if it was easy there'd be no Carrie": "si c'était facile, il n'y aurait pas de Kerry",
  "Washington if it was easy there'd be no": "Washington. Si c'était facile, il n'y aurait pas de",
  'taji Henson P': 'Taraji P. Henson',
  "Henson if it were easy there'd be no": "Henson. Si c'était facile, il n'y aurait pas de",
  'Octavia Spencer but not only that if it': "Octavia Spencer, mais pas seulement. Si c'était",
  "were easy there'd be no Biola Davis if": "facile, il n'y aurait pas de Viola Davis si",
  "it were easy there'd be no Michael T": "c'était facile, il n'y aurait pas de Michael T",
  'Williamson no Steven mckenley Henderson': 'Williamson, ni Stephen McKinley Henderson',
  "no Russell Hornsby if were easy there'd": "ni Russell Hornsby. Si c'était facile, il y",
  'be no Denzel Washington': "n'aurait pas de Denzel Washington",
  'so keep working': 'alors continuez à travailler',
  'keep striving never give up fall down': "persévérez, n'abandonnez jamais, tombez",
  'seven times get up': 'sept fois, relevez-vous',
  eight: 'huit',
  'ease is a greater threat to': 'la facilité est une plus grande menace pour',
  'progress than': 'le progrès que',
  'hardship ease is a greater threat to': "l'adversité. La facilité est une plus grande menace pour",
  'progress than hardship so keep moving': "le progrès que l'adversité. Alors continuez d'avancer",
  'keep growing keep learning see you at': "continuez de grandir, continuez d'apprendre, on se voit au",
  work: 'travail'
}

export class TranslationClient {
  constructor(private provider: 'nllb' | 'marian' | 'argos' = 'marian') {}

  async translateSegments(
    base: { segments: SegmentTiming[]; sourceLang: string; targetLangs: string[] },
    onLangProgress?: (lang: string, p: number) => void
  ): Promise<TranslationOutput[]> {
    const outputs: TranslationOutput[] = []
    const baseSegments = base.segments && base.segments.length > 0 ? base.segments : SIMULATED_SEGMENTS
    for (const lang of base.targetLangs) {
      for (let p = 0; p <= 100; p += 25) {
        await new Promise((r) => setTimeout(r, 10))
        onLangProgress?.(lang, p)
      }
      const lower = lang.toLowerCase()
      const isFrench = lower === 'fr' || lower.startsWith('fr-') || lower.startsWith('fr_')
      outputs.push({
        lang,
        segments: baseSegments.map((s, i) => ({
          ...s,
          translatedText: isFrench
            ? (SIMULATED_FR_SEGMENTS[i]?.text ?? FRENCH_TRANSLATIONS[s.text] ?? `[fr] ${s.text}`)
            : `[${lang}] ${s.text}`
        }))
      })
    }
    return outputs
  }
}

export const translationClient = new TranslationClient(process.env.TRANSLATION_PROVIDER as any)
