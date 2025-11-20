import type { SegmentTiming } from '../../../../shared/src/types/job'

/**
 * Format time for SRT subtitles (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`
}

/**
 * Format time for VTT subtitles (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

/**
 * Generate SRT subtitle content from segments
 */
export function generateSRT(segments: SegmentTiming[]): string {
  const lines: string[] = []

  for (const [index, segment] of segments.entries()) {
    lines.push(
      (index + 1).toString(),
      `${formatSRTTime(segment.start)} --> ${formatSRTTime(segment.end)}`,
      segment.text,
      ''
    )
  }

  return lines.join('\n')
}

/**
 * Generate VTT subtitle content from segments
 */
export function generateVTT(segments: SegmentTiming[]): string {
  const lines: string[] = ['WEBVTT', '']

  for (const segment of segments) {
    lines.push(`${formatVTTTime(segment.start)} --> ${formatVTTTime(segment.end)}`, segment.text, '')
  }

  return lines.join('\n')
}
