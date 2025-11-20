import { describe, expect, it } from 'vitest'
import type { SegmentTiming } from '../../../../../shared/src/types/job'
import { generateSRT, generateVTT } from './subtitle-generator'

describe('subtitle-generator', () => {
  const testSegments: SegmentTiming[] = [
    { start: 0, end: 2.5, text: 'Hello world' },
    { start: 2.5, end: 5.0, text: 'This is a test' },
    { start: 5.0, end: 7.3, text: 'Subtitle generation' }
  ]

  describe('generateSRT', () => {
    it('should generate valid SRT format', () => {
      const result = generateSRT(testSegments)

      expect(result).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world')
      expect(result).toContain('2\n00:00:02,500 --> 00:00:05,000\nThis is a test')
      expect(result).toContain('3\n00:00:05,000 --> 00:00:07,299\nSubtitle generation')
    })

    it('should format time correctly with hours', () => {
      const segments: SegmentTiming[] = [{ start: 3661.5, end: 3665.0, text: 'One hour later' }]
      const result = generateSRT(segments)

      expect(result).toContain('01:01:01,500 --> 01:01:05,000')
    })

    it('should handle empty segments', () => {
      const result = generateSRT([])
      expect(result).toBe('')
    })
  })

  describe('generateVTT', () => {
    it('should generate valid VTT format', () => {
      const result = generateVTT(testSegments)

      expect(result).toMatch(/^WEBVTT\n/)
      expect(result).toContain('00:00:00.000 --> 00:00:02.500\nHello world')
      expect(result).toContain('00:00:02.500 --> 00:00:05.000\nThis is a test')
      expect(result).toContain('00:00:05.000 --> 00:00:07.299\nSubtitle generation')
    })

    it('should format time correctly with hours', () => {
      const segments: SegmentTiming[] = [{ start: 3661.5, end: 3665.0, text: 'One hour later' }]
      const result = generateVTT(segments)

      expect(result).toContain('01:01:01.500 --> 01:01:05.000')
    })

    it('should start with WEBVTT header', () => {
      const result = generateVTT(testSegments)
      const lines = result.split('\n')
      expect(lines[0]).toBe('WEBVTT')
    })

    it('should handle empty segments', () => {
      const result = generateVTT([])
      expect(result).toBe('WEBVTT\n')
    })
  })
})
