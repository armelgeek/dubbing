import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  sourceVideoUrl: text('source_video_url'),
  status: text('status').notNull().default('DRAFT'),
  meta: jsonb('meta').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  progress: integer('progress').notNull().default(0),
  error: text('error'),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow()
})

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  meta: jsonb('meta').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const transcripts = pgTable('transcripts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  language: text('language').notNull(),
  segments: jsonb('segments').$type<any[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow()
})

export const translations = pgTable('translations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  lang: text('lang').notNull(),
  segments: jsonb('segments').$type<any[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow()
})

export const voiceProfiles = pgTable('voice_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  label: text('label').notNull(),
  provider: text('provider').notNull(),
  providerVoiceId: text('provider_voice_id'),
  active: boolean('active').default(true),
  meta: jsonb('meta').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow()
})

export const transcriptionCache = pgTable('transcription_cache', {
  hash: text('hash').primaryKey(),
  language: text('language').notNull(),
  segments: jsonb('segments').$type<any[]>().notNull(),
  duration: integer('duration').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})
