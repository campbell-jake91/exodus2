import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { App, Request } from '@tinyhttp/app'
import { tinyws, TinyWSRequest } from '../src/index'
import { once } from 'events'
import WebSocket, { WebSocketServer } from 'ws'

const t = suite('tinyws')

const s = (handler: (req: TinyWSRequest) => void, opts?: WebSocket.ServerOptions, inst?: WebSocket.Server) => {
  const app = new App<any, Request & TinyWSRequest>()

  app.use(tinyws(opts, inst))
  app.use('/ws', async (req) => {
    if (typeof req.ws !== 'undefined') {
      handler(req)
    }
  })

  return app
}

t('should respond with a message', async () => {
  const app = s(async (req) => {
    const ws = await req?.ws()

    return ws.send('hello there')
  })

  const server = app.listen(4443, undefined, 'localhost')

  const ws = new WebSocket('ws://localhost:4443/ws')

  const [data] = await once(ws, 'message')

  assert.equal(data.toString(), 'hello there')
  ws.close()
  server.close()
})

t('should resolve a `.ws` property', async () => {
  const app = s(async (req) => {
    const ws = await req.ws()

    assert.instance(ws, WebSocket)

    return ws.send('hello there')
  })

  const server = app.listen(4444, undefined, 'localhost')

  const ws = new WebSocket('ws://localhost:4444/ws')

  ws.on('message', () => {
    server.close()
    ws.close()
  })
})

t('should pass ws options', async () => {
  const app = s(
    async (req) => {
      const ws = await req.ws()

      assert.instance(ws, WebSocket)

      ws.on('error', (err) => {
        assert.match(err.message, 'Max payload size exceeded')
      })

      return ws.send('hello there')
    },
    {
      maxPayload: 2
    }
  )

  const server = app.listen(4445, undefined, 'localhost')

  const ws = new WebSocket('ws://localhost:4445/ws')

  await once(ws, 'message')

  ws.send('some lenghty message')

  server.close()
  ws.close()
})

t('should accept messages', async () => {
  const app = s(async (req) => {
    const ws = await req.ws()

    assert.instance(ws, WebSocket)

    return ws.on('message', (msg) => ws.send(`You sent: ${msg}`))
  })

  const server = app.listen(4446, undefined, 'localhost')

  const ws = new WebSocket('ws://localhost:4446/ws')

  await once(ws, 'open')

  ws.send('42')

  const [data] = await once(ws, 'message')

  assert.equal(data.toString(), 'You sent: 42')

  server.close()
  ws.close()
})

t('supports passing a server instance', async () => {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (socket) => {
    assert.instance(socket, WebSocket)
  })

  const app = s(
    async (req) => {
      const ws = await req.ws()

      assert.instance(ws, WebSocket)

      return ws.send('hello there')
    },
    {},
    wss
  )

  const server = app.listen(4447, undefined, 'localhost')

  const ws = new WebSocket('ws://localhost:4447/ws')

  await once(ws, 'message')

  server.close()
  ws.close()
})

t('returns a middleware function', () => {
  assert.type(tinyws(), 'function')
})

t.run()
