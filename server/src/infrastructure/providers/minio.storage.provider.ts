import type { StorageProvider, StoredObject } from './storage.provider'
import { randomUUID } from 'crypto'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export class MinioStorageProvider implements StorageProvider {
  id = 'minio'
  private client: any
  private bucket: string
  private publicBase?: string

  constructor() {
    let Minio: any
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Minio = require('minio')
    } catch {
      throw new Error('minio package not installed. Run: bun add minio')
    }
    this.client = new Minio.Client({
      endPoint: required('MINIO_ENDPOINT'),
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: required('MINIO_ACCESS_KEY'),
      secretKey: required('MINIO_SECRET_KEY')
    })
    this.bucket = required('MINIO_BUCKET')
    this.publicBase = process.env.MINIO_PUBLIC_BASE
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false)
    if (!exists) await this.client.makeBucket(this.bucket, 'us-east-1')
  }

  async put(key: string, data: Buffer | string, meta?: Record<string, any>): Promise<StoredObject> {
    await this.ensureBucket()
    const objectName = key || `${randomUUID()}`
    const buf = typeof data === 'string' ? Buffer.from(data) : data
    await this.client.putObject(this.bucket, objectName, buf, buf.length, meta ? { 'x-amz-meta-json': JSON.stringify(meta) } : undefined)
    const url = this.publicBase ? `${this.publicBase}/${this.bucket}/${objectName}` : `/${this.bucket}/${objectName}`
    return { key: objectName, url, size: buf.length, meta }
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureBucket()
    await this.client.removeObject(this.bucket, key)
    return true
  }
}
