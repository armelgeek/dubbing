import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Routes } from '../../domain/types'
import { PipelineOrchestrator } from '../../application/orchestrators/pipeline.orchestrator'
import { queueDispatcher } from '../queues/bullmq'
import { JobRepository } from '../repositories/job.repository'
import { TranscriptRepository } from '../repositories/transcript.repository'
import { TranslationRepository } from '../repositories/translation.repository'
import { MediaAssetRepository } from '../repositories/media-asset.repository'
import { ProjectRepository } from '../repositories/project.repository'

export class ProjectController implements Routes {
  public controller: OpenAPIHono
  private orchestrator: PipelineOrchestrator

  constructor() {
    this.controller = new OpenAPIHono()
    this.orchestrator = new PipelineOrchestrator(queueDispatcher)
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/projects/{id}/start',
        tags: ['Projects'],
        summary: 'Start dubbing pipeline for a project',
        request: {
          params: z.object({ id: z.string().openapi({ example: 'project-id' }) }),
          body: {
            content: {
              'application/json': {
                schema: z.object({ targetLangs: z.array(z.string()).min(1) })
              }
            }
          }
        },
        responses: {
          202: {
            description: 'Pipeline accepted',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean(), accepted: z.boolean() })
              }
            }
          }
        }
      }),
      async (c) => {
        const { id } = c.req.valid('param') as { id: string }
        const { targetLangs } = c.req.valid('json') as { targetLangs: string[] }
        await this.orchestrator.start(id, targetLangs)
        return c.json({ success: true, accepted: true }, 202)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/projects/{id}/jobs',
        tags: ['Projects'],
        summary: 'Get project pipeline state',
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            description: 'Pipeline state',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  jobs: z.array(z.any()),
                  transcripts: z.array(z.any()),
                  translations: z.array(z.any()),
                  mediaAssets: z.array(z.any())
                })
              }
            }
          }
        }
      }),
      async (c) => {
        const { id } = c.req.valid('param') as { id: string }
        const jobRepo = new JobRepository()
        const transcriptRepo = new TranscriptRepository()
        const translationRepo = new TranslationRepository()
        const mediaRepo = new MediaAssetRepository()
        const [jobs, transcripts, translations, mediaAssets] = await Promise.all([
          jobRepo.listForProject(id),
          transcriptRepo.listForProject(id),
          translationRepo.listForProject(id),
          mediaRepo.listForProject(id)
        ])
        return c.json({ success: true, jobs, transcripts, translations, mediaAssets }, 200)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/projects/{id}/summary',
        tags: ['Projects'],
        summary: 'Get aggregated project summary',
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            description: 'Summary',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  project: z.any(),
                  jobs: z.array(z.any()),
                  stats: z.object({
                    totalJobs: z.number(),
                    completed: z.number(),
                    errored: z.number(),
                    avgDurationMs: z.number().nullable(),
                    totalDurationMs: z.number().nullable()
                  }),
                  languages: z.array(z.string()),
                  assets: z.object({
                    transcriptCount: z.number(),
                    translationCount: z.number(),
                    mediaCount: z.number()
                  })
                })
              }
            }
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), error: z.string() }) } }
          }
        }
      }),
      async (c) => {
        const { id } = c.req.valid('param') as { id: string }
        const projectRepo = new ProjectRepository()
        const jobRepo = new JobRepository()
        const transcriptRepo = new TranscriptRepository()
        const translationRepo = new TranslationRepository()
        const mediaRepo = new MediaAssetRepository()
        const [project, jobs, transcripts, translations, mediaAssets] = await Promise.all([
          projectRepo.findById(id),
          jobRepo.listForProject(id),
          transcriptRepo.listForProject(id),
          translationRepo.listForProject(id),
          mediaRepo.listForProject(id)
        ])
        if (!project) return c.json({ success: false, error: 'Not found' }, 404)
        const durations = jobs
          .filter(j => j.startedAt && j.finishedAt)
          .map(j => new Date(j.finishedAt as Date).getTime() - new Date(j.startedAt as Date).getTime())
        const totalDuration = durations.length ? durations.reduce((a, b) => a + b, 0) : null
        const avgDuration = durations.length ? Math.round(totalDuration! / durations.length) : null
        const languages = Array.from(new Set([
          ...transcripts.map(t => t.language).filter(Boolean),
          ...translations.map(tr => tr.lang).filter(Boolean)
        ] as string[]))
        const stats = {
          totalJobs: jobs.length,
          completed: jobs.filter(j => j.status === 'DONE').length,
          errored: jobs.filter(j => j.status === 'ERROR').length,
          avgDurationMs: avgDuration,
          totalDurationMs: totalDuration
        }
        return c.json({
          success: true,
          project,
          jobs,
          stats,
          languages,
          assets: {
            transcriptCount: transcripts.length,
            translationCount: translations.length,
            mediaCount: mediaAssets.length
          }
        }, 200)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/projects',
        tags: ['Projects'],
        summary: 'Create project',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({
                  id: z.string().optional(),
                  userId: z.string(),
                  title: z.string().min(1),
                  sourceVideoUrl: z.string().url().optional()
                })
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Created',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), project: z.any() }) } }
          },
          400: { description: 'Bad request', content: { 'application/json': { schema: z.object({ success: z.boolean(), error: z.string() }) } } }
        }
      }),
      async (c) => {
        const body = await c.req.json()
        const schema = z.object({ id: z.string().optional(), userId: z.string(), title: z.string().min(1), sourceVideoUrl: z.string().optional() })
        const parsed = schema.parse(body)
        const projectRepo = new ProjectRepository()
        const id = parsed.id || crypto.randomUUID()
        const project = await projectRepo.create({ id, userId: parsed.userId, title: parsed.title, sourceVideoUrl: parsed.sourceVideoUrl })
        return c.json({ success: true, project }, 201)
      }
    )
  }
}
