type StatBucket = {
  count: number
  totalMs: number
  min: number
  max: number
  mean: number
}

function createBucket(): StatBucket {
  return { count: 0, totalMs: 0, min: Number.POSITIVE_INFINITY, max: 0, mean: 0 }
}

interface JobKindStats {
  started: number
  completed: number
  errored: number
  durations: StatBucket
}

function createJobKindStats(): JobKindStats {
  return { started: 0, completed: 0, errored: 0, durations: createBucket() }
}

const jobStats: Record<string, JobKindStats> = {}

function bucketAdd(b: StatBucket, value: number) {
  b.count += 1
  b.totalMs += value
  if (value < b.min) b.min = value
  if (value > b.max) b.max = value
  // incremental mean (Welford simplified as no variance needed)
  b.mean += (value - b.mean) / b.count
}

export function recordJobStart(kind: string) {
  const k = jobStats[kind] || (jobStats[kind] = createJobKindStats())
  k.started += 1
}

export function recordJobEnd(kind: string, durationMs: number, success: boolean) {
  const k = jobStats[kind] || (jobStats[kind] = createJobKindStats())
  if (success) k.completed += 1
  else k.errored += 1
  bucketAdd(k.durations, durationMs)
}

export function snapshot() {
  const perKind = Object.entries(jobStats).map(([kind, s]) => ({
    kind,
    started: s.started,
    completed: s.completed,
    errored: s.errored,
    durations: {
      count: s.durations.count,
      totalMs: s.durations.count ? s.durations.totalMs : 0,
      minMs: s.durations.count ? s.durations.min : 0,
      maxMs: s.durations.count ? s.durations.max : 0,
      meanMs: s.durations.count ? Math.round(s.durations.mean) : 0
    }
  }))
  const aggregate = perKind.reduce(
    (acc, k) => {
      acc.started += k.started
      acc.completed += k.completed
      acc.errored += k.errored
      acc.totalDurationMs += k.durations.totalMs
      return acc
    },
    { started: 0, completed: 0, errored: 0, totalDurationMs: 0 }
  )
  return { generatedAt: new Date().toISOString(), aggregate, perKind }
}
