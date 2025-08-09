import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Routes } from '../../domain/types'
import { snapshot } from '../metrics/metrics.registry'

export class MetricsController implements Routes {
  public controller: OpenAPIHono
  constructor() {
    this.controller = new OpenAPIHono()
  }
  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/metrics',
        tags: ['Metrics'],
        summary: 'Get in-memory pipeline metrics',
        responses: {
          200: {
            description: 'Metrics snapshot',
            content: {
              'application/json': {
                schema: z.object({
                  generatedAt: z.string(),
                  aggregate: z.object({
                    started: z.number(),
                    completed: z.number(),
                    errored: z.number(),
                    totalDurationMs: z.number()
                  }),
                  perKind: z.array(z.object({
                    kind: z.string(),
                    started: z.number(),
                    completed: z.number(),
                    errored: z.number(),
                    durations: z.object({
                      count: z.number(),
                      totalMs: z.number(),
                      minMs: z.number(),
                      maxMs: z.number(),
                      meanMs: z.number()
                    })
                  }))
                })
              }
            }
          }
        }
      }),
      async (c) => c.json(snapshot(), 200)
    )
  }
}
