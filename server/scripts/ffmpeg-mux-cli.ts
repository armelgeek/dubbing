#!/usr/bin/env bun
/**
 * CLI utilitaire pour tester le mixage vidéo+audio avec FFmpeg
 * Usage :
 *   bun run scripts/ffmpeg-mux-cli.ts --video=path.mp4 --audio=path.wav --out=output.mp4
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
// Bun: use process from 'process' import
function parseArgs() {
  const args = process.argv.slice(2)
  const opts: Record<string, string> = {}
  for (const arg of args) {
    const [k, v] = arg.replace(/^--/, '').split('=')
    opts[k] = v
  }
  return opts
}

function runFFmpeg({ video, audio, out, originalVolume, dubVolume }: { video: string; audio: string; out: string; originalVolume?: number; dubVolume?: number }) {
  return new Promise<void>((resolvePromise, reject) => {
    const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg'
    let args: string[]
    if (typeof originalVolume === 'number' || typeof dubVolume === 'number') {
      const origVol = typeof originalVolume === 'number' && !Number.isNaN(originalVolume) ? originalVolume : 0.2
      const dubVol = typeof dubVolume === 'number' && !Number.isNaN(dubVolume) ? dubVolume : 1
      const filter = `[0:a]volume=${origVol}[a0];[1:a]volume=${dubVol}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      args = [
        '-y',
        '-i', video,
        '-i', audio,
        '-filter_complex', filter,
        '-map', '0:v:0',
        '-map', '[aout]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-movflags', '+faststart',
        out
      ]
    } else {
      args = [
        '-y',
        '-i', video,
        '-i', audio,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-movflags', '+faststart',
        out
      ]
    }
    const proc = spawn(ffmpegBin, args, { stdio: 'inherit' })
    proc.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`FFmpeg exited with code ${code}`))
    })
  })
}

async function main() {
  const opts = parseArgs()
  const video = opts.video as string
  const audio = opts.audio as string
  const out = opts.out as string
  const originalVolume = opts.originalVolume ? Number(opts.originalVolume) : undefined
  const dubVolume = opts.dubVolume ? Number(opts.dubVolume) : undefined
  // Bun: process.exit is available on globalThis.process
  const proc = typeof process.exit === 'function' ? process : (globalThis as any).process
  if (!video || !audio || !out) {
    console.error('Usage: bun run scripts/ffmpeg-mux-cli.ts --video=path.mp4 --audio=path.wav --out=output.mp4 [--originalVolume=0.2] [--dubVolume=1]')
    proc.exit(1)
  }
  if (!video || !existsSync(video)) throw new Error(`Video not found: ${video}`)
  if (!audio || !existsSync(audio)) throw new Error(`Audio not found: ${audio}`)
  if (typeof originalVolume === 'number' || typeof dubVolume === 'number') {
    const origVol = typeof originalVolume === 'number' && !Number.isNaN(originalVolume) ? originalVolume : 0.2
    const dubVol = typeof dubVolume === 'number' && !Number.isNaN(dubVolume) ? dubVolume : 1
    console.log(`Mixage: ${video} + ${audio} => ${out} (originalVolume=${origVol}, dubVolume=${dubVol})`)
    await runFFmpeg({ video, audio, out, originalVolume: origVol, dubVolume: dubVol })
  } else {
    console.log(`Mixage: ${video} + ${audio} => ${out}`)
    await runFFmpeg({ video, audio, out })
  }
  console.log('✅ Mixage terminé:', out)
}

main().catch((error) => {
  console.error('Erreur:', error)
  const proc = typeof process.exit === 'function' ? process : (globalThis as any).process
  proc.exit(1)
})
