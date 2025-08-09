declare module 'ws' {
  export class WebSocketServer {
    constructor(opts: any)
    on(event: 'connection', cb: (socket: any, req: any) => void): void
  }
  export interface WebSocket {
    readyState: number
    send(data: any): void
    close(code?: number, reason?: string): void
    on(event: string, cb: (...args: any[]) => void): void
  }
}
