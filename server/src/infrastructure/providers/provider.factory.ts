import process from 'node:process'
import { storageProvider as localStorage, type StorageProvider } from './storage.provider'
import { transcriptionProvider as localTranscription } from './transcription.provider'
import { translationProvider as localTranslation } from './translation.provider'
import { ttsProvider as localTts } from './tts.provider'

// Placeholders for future external implementations
// They can be dynamically imported later when needed.

export const Providers = {
  transcription() {
    switch (process.env.TRANSCRIPTION_PROVIDER) {
      // case 'external': return new ExternalTranscriptionProvider()
      default:
        return localTranscription
    }
  },
  translation() {
    switch (process.env.TRANSLATION_PROVIDER) {
      default:
        return localTranslation
    }
  },
  tts() {
    switch (process.env.TTS_PROVIDER) {
      default:
        return localTts
    }
  },
  storage(): StorageProvider {
    const kind = process.env.STORAGE_PROVIDER || 'local'
    switch (kind) {
      default:
        return localStorage
    }
  }
}
