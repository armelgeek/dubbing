import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

export interface StoredObject {
  key: string
  url: string
  size: number
  meta?: Record<string, any>
}

export interface StorageProvider {
  id: string
  put: (key: string, data: Buffer | string, meta?: Record<string, any>) => Promise<StoredObject>
}

function normalizePublicBase(input: string): string {
  return input.replace(/\/+$/, '') || '/assets'
}

class LocalFsStorageProvider implements StorageProvider {
  id = 'local-fs'
  constructor(
    private baseDir: string,
    private publicBase: string
  ) {}

  put = async (key: string, data: Buffer | string, meta?: Record<string, any>): Promise<StoredObject> => {
    const full = join(this.baseDir, key)
    await fs.mkdir(dirname(full), { recursive: true })
    const buf = typeof data === 'string' ? Buffer.from(data) : data
    await fs.writeFile(full, buf)
    const urlBase = normalizePublicBase(this.publicBase)
    return { key, url: `${urlBase}/${key}`, size: buf.length, meta }
  }
}

const DEFAULT_BASE_DIR = process.env.ASSETS_BASE_DIR || '/tmp/dubbing-assets'
const DEFAULT_PUBLIC_PREFIX = process.env.ASSETS_PUBLIC_PREFIX || '/assets'

export const storageProvider: StorageProvider = new LocalFsStorageProvider(DEFAULT_BASE_DIR, DEFAULT_PUBLIC_PREFIX)
