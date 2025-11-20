import process from 'node:process'
import { App } from './app'
import { BlogController, PermissionController, UserController, ProjectController, UploadController } from './infrastructure/controllers'
import { CategoryController } from './infrastructure/controllers/category.controller'
import { MetricsController } from './infrastructure/controllers/metrics.controller'
// Worker imports to register processors
import './infrastructure/queues/workers/transcribe.worker'
import './infrastructure/queues/workers/translate.worker'
import './infrastructure/queues/workers/subtitle.worker'
import './infrastructure/queues/workers/voice.worker'
import './infrastructure/queues/workers/lipsync.worker'
import './infrastructure/queues/workers/mux.worker'

const app = new App([
  new UserController(),
  new PermissionController(),
  new BlogController(),
  new CategoryController(),
  new ProjectController(),
  new MetricsController(),
  new UploadController()
]).getApp()

const port = Number(process.env.PORT) || 3000

console.info(`🚀 Server is running on port ${port}`)
console.info(`📚 API Documentation: http://localhost:${port}/docs`)
console.info(`🔍 OpenAPI Schema: http://localhost:${port}/swagger`)

export default {
  port,
  fetch: app.fetch
}
