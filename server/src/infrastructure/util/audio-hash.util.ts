import { createHash } from 'crypto'
import { promises as fs } from 'fs'

export async function hashFile(path: string): Promise<string> {
  const buf = await fs.readFile(path)
  return createHash('sha256').update(buf).digest('hex')
}
