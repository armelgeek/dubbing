import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Routes } from '../../domain/types'
import { randomUUID } from 'crypto'
import { Providers } from '../providers/provider.factory'
import { MediaAssetRepository } from '../repositories/media-asset.repository'

export class UploadController implements Routes {
  public controller: OpenAPIHono
  private mediaRepo: MediaAssetRepository

  constructor() {
    this.controller = new OpenAPIHono()
    this.mediaRepo = new MediaAssetRepository()
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/uploads/video',
        tags: ['Uploads'],
        summary: 'Upload a source video file',
        request: {
          body: {
            content: {
              'multipart/form-data': {
                schema: z.object({
                  file: z.any().openapi({ type: 'string', format: 'binary' }),
                  projectId: z.string().optional(),
                  title: z.string().optional()
                })
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Video uploaded',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  key: z.string(),
                  url: z.string(),
                  size: z.number(),
                  projectId: z.string().optional()
                })
              }
            }
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean(), error: z.string() })
              }
            }
          }
        }
      }),
      async (c) => {
        const form: any = await c.req.parseBody()
        const file = form.file as File | undefined
        if (!file) return c.json({ success: false, error: 'file required' }, 400)
        const projectId = form.projectId as string | undefined
        const originalName = (file as any).name || 'video'
        const ext = originalName.includes('.') ? originalName.split('.').pop() : 'mp4'
        const key = `source-videos/${randomUUID()}.${ext}`
        const arrayBuffer = await file.arrayBuffer()
        const storage = Providers.storage()
        const stored = await storage.put(key, Buffer.from(arrayBuffer), { originalName, type: file.type })
        if (projectId) {
          await this.mediaRepo.insert({ id: randomUUID(), projectId, type: 'SOURCE_VIDEO', url: stored.url, meta: { size: stored.size, originalName } })
        }
        return c.json({ success: true, key: stored.key, url: stored.url, size: stored.size, projectId }, 201)
      }
    )
  }
}
