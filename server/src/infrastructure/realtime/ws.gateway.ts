import { WebSocketServer, WebSocket } from 'ws'
import type { JobProgressEvent } from '../../../../shared/src/types/job'

interface ClientCtx {
  socket: WebSocket
  projectId: string
}

const clients = new Set<ClientCtx>()

export function createWsGateway(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' })
  wss.on('connection', (socket, req) => {
    const url = new URL(req.url || '', 'http://localhost')
    const projectId = url.searchParams.get('projectId')
    if (!projectId) {
      socket.close(1008, 'projectId required')
      return
    }
    const ctx: ClientCtx = { socket, projectId }
    clients.add(ctx)

    socket.on('close', () => {
      clients.delete(ctx)
    })
  })
  return wss
}

export function broadcastProgress(ev: JobProgressEvent) {
  for (const c of clients) {
    if (c.projectId === ev.projectId && c.socket.readyState === 1) {
      c.socket.send(JSON.stringify(ev))
    }
  }
}
