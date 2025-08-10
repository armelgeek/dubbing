import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Providers } from '../providers/provider.factory'

function withTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`
}

const LOCAL_ASSETS_BASE_DIR = process.env.ASSETS_BASE_DIR || '/tmp/dubbing-assets'
const LOCAL_PUBLIC_PREFIX = withTrailingSlash(process.env.ASSETS_PUBLIC_PREFIX || '/assets')

async function downloadToTmp(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  const arr = await res.arrayBuffer()
  const buf = Buffer.from(arr)
  const name = `mux-${randomUUID()}${extname(new URL(url).pathname) || ''}`
  const out = join(tmpdir(), name)
  await fs.writeFile(out, buf)
  return out
}

async function resolveToLocalPath(inputUrl: string): Promise<{ path: string; isTemp: boolean }> {
  try {
    const u = new URL(inputUrl, 'file://')
    const isHttp = u.protocol === 'http:' || u.protocol === 'https:'

    if (isHttp) {
      const pathname = u.pathname
      if (pathname.startsWith(LOCAL_PUBLIC_PREFIX)) {
        const key = pathname.slice(LOCAL_PUBLIC_PREFIX.length)
        return { path: join(LOCAL_ASSETS_BASE_DIR, key), isTemp: false }
      }
      const downloaded = await downloadToTmp(inputUrl)
      return { path: downloaded, isTemp: true }
    }

    if (inputUrl.startsWith('file://')) {
      return { path: fileURLToPath(inputUrl), isTemp: false }
    }

    if (inputUrl.startsWith(LOCAL_PUBLIC_PREFIX)) {
      const key = inputUrl.slice(LOCAL_PUBLIC_PREFIX.length)
      return { path: join(LOCAL_ASSETS_BASE_DIR, key), isTemp: false }
    }

    if (inputUrl.startsWith('/')) {
      return { path: inputUrl, isTemp: false }
    }

    const downloaded = await downloadToTmp(inputUrl)
    return { path: downloaded, isTemp: true }
  } catch {
    return { path: inputUrl, isTemp: false }
  }
}

function runFFmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let errBuf = ''
    child.stderr.on('data', (d) => {
      errBuf += d?.toString?.() || ''
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${errBuf}`))
    })
  })
}

export async function muxDubbedVideo(params: {
  sourceUrl: string
  audioUrl: string
  outKey: string
  meta?: Record<string, any>
}): Promise<{ key: string; url: string; size: number }> {
  const { sourceUrl, audioUrl, outKey, meta } = params

  const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg'

  const [video, audio] = await Promise.all([resolveToLocalPath(sourceUrl), resolveToLocalPath(audioUrl)])

  const outPath = join(tmpdir(), `mux-out-${randomUUID()}.mp4`)
  const args = [
    '-y',
    '-i',
    video.path,
    '-i',
    audio.path,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    '-movflags',
    '+faststart',
    outPath
  ]

  try {
    await runFFmpeg(ffmpegBin, args)
  } catch (error: any) {
    const noFfmpeg = error?.code === 'ENOENT' || /ENOENT|not found|spawn.*ENOENT/i.test(String(error))

    if (noFfmpeg && process.env.MUX_FALLBACK_PLACEHOLDER === '1') {
      const placeholder = Buffer.from('mux placeholder')
      const stored = await Providers.storage().put(outKey, placeholder, {
        ...meta,
        fallback: true,
        reason: 'no-ffmpeg'
      })
      return stored
    }

    if (noFfmpeg) {
      throw new Error(
        'FFmpeg is not available. Set FFMPEG_BIN or install ffmpeg. Optionally set MUX_FALLBACK_PLACEHOLDER=1 to store a placeholder instead.'
      )
    }
    throw error
  }

  const buf = await fs.readFile(outPath)
  const stored = await Providers.storage().put(outKey, buf, meta)

  await Promise.allSettled([
    video.isTemp ? fs.unlink(video.path) : Promise.resolve(),
    audio.isTemp ? fs.unlink(audio.path) : Promise.resolve(),
    fs.unlink(outPath)
  ])

  return stored
}
