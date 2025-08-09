import { transcriptionProvider as localTranscription } from './transcription.provider'
import { ttsProvider as localTts } from './tts.provider'
import { translationProvider as localTranslation } from './translation.provider'
import { storageProvider as localStorage, StorageProvider } from './storage.provider'

let minioLoaded: any
function getMinio() {
  if (!minioLoaded) {
    try {
      // dynamic import to avoid runtime error if not installed
      // @ts-ignore
      minioLoaded = require('./minio.storage.provider')
    } catch (e) {
      throw new Error('MinIO provider requested but minio dependency not installed')
    }
  }
  return minioLoaded
}

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
      case 'minio':
        return new (getMinio().MinioStorageProvider)()
      default:
        return localStorage
    }
  }
}
