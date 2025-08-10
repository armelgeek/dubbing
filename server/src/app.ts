import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import router, { type auth } from './infrastructure/config/auth.config'
import { errorHandler, notFound } from './infrastructure/middlewares/error.middleware'
import { responseMiddleware } from './infrastructure/middlewares/response.middleware'
import addSession from './infrastructure/middlewares/session.middleware'
import sessionValidator from './infrastructure/middlewares/unauthorized-access.middleware'
import { Home } from './infrastructure/pages/home'
import type { Routes } from './domain/types'

export class App {
  private app: OpenAPIHono<{
    Variables: {
      user: typeof auth.$Infer.Session.user | null
      session: typeof auth.$Infer.Session.session | null
    }
  }>
  constructor(routes: Routes[]) {
    this.app = new OpenAPIHono<{
      Variables: {
        user: typeof auth.$Infer.Session.user | null
        session: typeof auth.$Infer.Session.session | null
      }
    }>()
    this.initializeGlobalMiddlewares()
    this.initializeRoutes(routes)
    this.initializeSwaggerUI()
    this.initializeRouteFallback()
    this.initializeErrorHandler()
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach((route) => {
      route.initRoutes()
      this.app.route('/api', route.controller)
    })
    this.app.basePath('/api').route('/', router)
    this.app.route('/', Home)
  }

  private initializeGlobalMiddlewares() {
    this.app.use(logger())
    this.app.use(prettyJSON())
    // Serve uploaded assets from local storage (configurable)
    const assetsBaseDir = Bun.env.ASSETS_BASE_DIR || '/tmp/dubbing-assets'
    let publicPrefix = Bun.env.ASSETS_PUBLIC_PREFIX || '/assets'
    if (!publicPrefix.startsWith('/')) publicPrefix = `/${publicPrefix}`
    const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
    const escaped = publicPrefix.replaceAll(ESCAPE_RE, String.raw`\$&`)
    const mountPath = publicPrefix.endsWith('/') ? `${publicPrefix}*` : `${publicPrefix}/*`

    this.app.use(
      mountPath,
      serveStatic({
        root: assetsBaseDir,
        rewriteRequestPath: (path) => path.replace(new RegExp(`^${escaped}`), '')
      })
    )

    this.app.use(
      '*',
      cors({
        origin: [Bun.env.BETTER_AUTH_URL || 'http://localhost:3000', Bun.env.REACT_APP_URL || 'http://localhost:5173'],
        credentials: true,
        maxAge: 86400
      })
    )
    this.app.use('*', responseMiddleware())
    this.app.use(addSession)
    this.app.use(sessionValidator)
  }

  private initializeSwaggerUI() {
    this.app.doc31('/swagger', (c) => {
      const { protocol: urlProtocol, hostname, port } = new URL(c.req.url)
      const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol

      return {
        openapi: '3.1.0',

        info: {
          version: '1.0.0',
          title: 'API',
          description: `# Introduction 
        \n API . \n`
        },
        servers: [{ url: `${protocol}//${hostname}${port ? `:${port}` : ''}`, description: 'Current environment' }]
      }
    })

    this.app.get(
      '/docs',
      apiReference({
        pageTitle: 'API Documentation',
        theme: 'deepSpace',
        isEditable: false,
        layout: 'modern',
        darkMode: true,
        metaData: {
          applicationName: 'API',
          author: 'Armel Wanes',
          creator: 'Armel Wanes',
          publisher: 'Armel Wanes',
          robots: 'index, follow',
          description: 'API is ....'
        },
        url: 'swagger'
      })
    )
  }

  private initializeRouteFallback() {
    this.app.notFound((ctx) => {
      return ctx.json({ success: false, message: 'route not found' }, 404)
    })
  }

  private initializeErrorHandler() {
    this.app.notFound(notFound)
    this.app.onError(errorHandler)
  }

  public getApp() {
    return this.app
  }
}
