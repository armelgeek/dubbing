import { promises as fs } from 'fs'
import { dirname, join } from 'path'

export interface StoredObject {
  key: string
  url: string
  size: number
  meta?: Record<string, any>
}

export interface StorageProvider {
  id: string
  put(key: string, data: Buffer | string, meta?: Record<string, any>): Promise<StoredObject>
}

class LocalFsStorageProvider implements StorageProvider {
  id = 'local-fs'
  constructor(private baseDir: string = '/tmp/dubbing-assets', private publicBase = '/assets') {}
  async put(key: string, data: Buffer | string, meta?: Record<string, any>): Promise<StoredObject> {
    const full = join(this.baseDir, key)
    await fs.mkdir(dirname(full), { recursive: true })
    const buf = typeof data === 'string' ? Buffer.from(data) : data
    await fs.writeFile(full, buf)
    return { key, url: `${this.publicBase}/${key}`, size: buf.length, meta }
  }
}

export const storageProvider: StorageProvider = new LocalFsStorageProvider()
