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
  audioUrl?: string
  subtitleUrl?: string
  outKey: string
  meta?: Record<string, any>
  originalVolume?: number // default 0.2
  dubVolume?: number // default 1.0
}): Promise<{ key: string; url: string; size: number }> {
  const { sourceUrl, audioUrl, subtitleUrl, outKey, meta, originalVolume = 0.2, dubVolume = 1.0 } = params

  const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg'

  const toResolve: Promise<{ path: string; isTemp: boolean }>[] = [resolveToLocalPath(sourceUrl)]
  if (audioUrl) toResolve.push(resolveToLocalPath(audioUrl))
  if (subtitleUrl) toResolve.push(resolveToLocalPath(subtitleUrl))

  const [video, audio, subtitle] = await Promise.all(toResolve)

  const outPath = join(tmpdir(), `mux-out-${randomUUID()}.mp4`)
  
  const args: string[] = ['-y', '-i', video.path]
  
  // Add audio input if provided
  if (audio) {
    args.push('-i', audio.path)
  }
  
  // Add subtitle input if provided
  if (subtitle) {
    args.push('-i', subtitle.path)
  }

  // Build filter and mapping
  if (audio && !subtitle) {
    // Audio dubbing only (original behavior)
    const filter = `[0:a]volume=${originalVolume}[a0];[1:a]volume=${dubVolume}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
    args.push('-filter_complex', filter, '-map', '0:v:0', '-map', '[aout]')
  } else if (audio && subtitle) {
    // Audio dubbing + subtitles
    const filter = `[0:a]volume=${originalVolume}[a0];[1:a]volume=${dubVolume}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
    args.push('-filter_complex', filter, '-map', '0:v:0', '-map', '[aout]', '-map', '2:s:0')
  } else if (subtitle && !audio) {
    // Subtitle only (no audio dubbing)
    args.push('-map', '0:v:0', '-map', '0:a:0', '-map', '1:s:0')
  } else {
    // No audio, no subtitle (shouldn't happen, but copy everything)
    args.push('-map', '0:v:0', '-map', '0:a:0')
  }

  // Common output options
  args.push('-c:v', 'copy')
  
  if (subtitle) {
    args.push('-c:s', 'mov_text') // Embed subtitles in MP4
  }
  
  if (audio || !subtitle) {
    args.push('-c:a', 'aac')
  } else {
    args.push('-c:a', 'copy')
  }
  
  args.push('-shortest', '-movflags', '+faststart', outPath)

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
    audio?.isTemp ? fs.unlink(audio.path) : Promise.resolve(),
    subtitle?.isTemp ? fs.unlink(subtitle.path) : Promise.resolve(),
    fs.unlink(outPath)
  ])

  return stored
}
