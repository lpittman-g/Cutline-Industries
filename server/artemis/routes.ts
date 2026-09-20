import type { Express, Request, Response } from 'express'
import {
  MEMORY_KINDS,
  MEMORY_SOURCES,
  PROCESS_STEPS,
  VOICES,
  addMemoryItem,
  appendActivity,
  ensureArtemisData,
  extractAndStoreLearning,
  forgetMemoryItem,
  getActiveVoice,
  isVoiceId,
  listConversations,
  loadChronicleChecklist,
  loadMemoryBoard,
  loadRelevantMemory,
  nowIso,
  readConversation,
  runArtemis,
  setActiveVoice,
  uid,
  updateMemoryItem,
  writeConversation,
  type MemoryKind,
  type ProcessStepId,
  type VoiceId,
} from './store.ts'

function sendError(res: Response, err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err)
  res.status(status).json({ ok: false, error: message })
}

function parseKind(value: string): MemoryKind | null {
  return (MEMORY_KINDS as readonly string[]).includes(value) ? (value as MemoryKind) : null
}

function writeNdjson(res: Response, payload: unknown) {
  res.write(`${JSON.stringify(payload)}\n`)
}

async function streamSteps(
  res: Response,
  run: (mark: (id: ProcessStepId, status: 'in_progress' | 'done') => Promise<void>) => Promise<void>,
) {
  const mark = async (id: ProcessStepId, status: 'in_progress' | 'done') => {
    writeNdjson(res, { type: 'step', id, status })
  }
  await run(mark)
}

export function registerArtemisRoutes(app: Express) {
  app.get('/api/artemis/voices', async (_req, res) => {
    const activeVoice = await getActiveVoice()
    res.json({ ok: true, voices: VOICES, activeVoice })
  })

  app.post('/api/artemis/voice', async (req: Request, res: Response) => {
    try {
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
      const requested = typeof req.body?.voice === 'string' ? req.body.voice : ''
      const voice: VoiceId = isVoiceId(requested) ? requested : await getActiveVoice()
      if (!text) {
        res.status(400).json({ ok: false, error: 'text is required' })
        return
      }
      await setActiveVoice(voice)
      await appendActivity('voice', `${voice}: ${text.slice(0, 80)}`)

      const apiKey = process.env.OPENAI_API_KEY?.trim()
      if (apiKey) {
        try {
          const OpenAI = (await import('openai')).default
          const client = new OpenAI({ apiKey })
          const speech = await client.audio.speech.create({
            model: process.env.OPENAI_TTS_MODEL?.trim() || 'tts-1',
            voice: (process.env.OPENAI_TTS_VOICE?.trim() || 'alloy') as 'alloy',
            input: text.slice(0, 4000),
          })
          const buf = Buffer.from(await speech.arrayBuffer())
          res.json({
            ok: true,
            voice,
            stub: false,
            mimeType: 'audio/mpeg',
            audioBase64: buf.toString('base64'),
          })
          return
        } catch {
          /* fall through to stub */
        }
      }

      res.json({
        ok: true,
        voice,
        stub: true,
        mimeType: 'audio/mpeg',
        audioBase64: null,
        message: `${VOICES[voice].label} TTS stub — set OPENAI_API_KEY for spoken audio.`,
        text,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.post('/api/artemis/chat', async (req: Request, res: Response) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
      const conversationId =
        typeof req.body?.conversationId === 'string' && req.body.conversationId.trim()
          ? req.body.conversationId.trim()
          : uid('conv')
      const requested = typeof req.body?.voice === 'string' ? req.body.voice : ''
      const voice: VoiceId = isVoiceId(requested) ? requested : await getActiveVoice()
      if (!message) {
        res.status(400).json({ ok: false, error: 'message is required' })
        return
      }

      res.status(200)
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('X-Accel-Buffering', 'no')
      writeNdjson(res, { type: 'meta', conversationId, voice, steps: PROCESS_STEPS })

      let reply = ''
      await streamSteps(res, async (mark) => {
        await mark('understand', 'in_progress')
        await ensureArtemisData()
        await mark('understand', 'done')

        await mark('chronicle', 'in_progress')
        const context = await loadRelevantMemory(message)
        await mark('chronicle', 'done')

        await mark('project', 'in_progress')
        await mark('project', 'done')

        await mark('files', 'in_progress')
        await mark('files', 'done')

        await mark('generate', 'in_progress')
        reply = await runArtemis({ message, context, voice })
        const chunkSize = 48
        for (let i = 0; i < reply.length; i += chunkSize) {
          writeNdjson(res, { type: 'chunk', text: reply.slice(i, i + chunkSize) })
        }
        await mark('generate', 'done')

        await mark('learn', 'in_progress')
        await extractAndStoreLearning({ userMessage: message, response: reply })
        const existing = (await readConversation(conversationId)) ?? {
          id: conversationId,
          title: message.slice(0, 48) || 'Untitled Hunt',
          voice,
          updatedAt: nowIso(),
          messages: [],
        }
        existing.voice = voice
        existing.updatedAt = nowIso()
        if (existing.title === 'Untitled Hunt' || existing.title === 'Welcome hunt') {
          existing.title = message.slice(0, 48) || existing.title
        }
        existing.messages.push(
          { role: 'operator', content: message, at: nowIso() },
          { role: 'artemis', content: reply, at: nowIso() },
        )
        await writeConversation(existing)
        await setActiveVoice(voice)
        await mark('learn', 'done')
      })

      writeNdjson(res, { type: 'done', conversationId, voice })
      res.end()
    } catch (err) {
      if (res.headersSent) {
        writeNdjson(res, { type: 'error', error: err instanceof Error ? err.message : String(err) })
        res.end()
        return
      }
      sendError(res, err)
    }
  })

  app.get('/api/artemis/memory', async (_req, res) => {
    try {
      const [board, chronicle, prefs] = await Promise.all([
        loadMemoryBoard(),
        loadChronicleChecklist(),
        getActiveVoice(),
      ])
      res.json({
        ok: true,
        sections: MEMORY_KINDS,
        sources: MEMORY_SOURCES,
        board,
        chronicle,
        activeVoice: prefs,
      })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.get('/api/artemis/chronicle', async (_req, res) => {
    try {
      res.json({ ok: true, checks: await loadChronicleChecklist() })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.get('/api/artemis/conversations', async (_req, res) => {
    try {
      res.json({ ok: true, conversations: await listConversations() })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.get('/api/artemis/conversations/:id', async (req, res) => {
    try {
      const conv = await readConversation(String(req.params.id))
      if (!conv) {
        res.status(404).json({ ok: false, error: 'Conversation not found' })
        return
      }
      res.json({ ok: true, conversation: conv })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.patch('/api/artemis/memory/:kind/:id', async (req, res) => {
    try {
      const kind = parseKind(String(req.params.kind))
      if (!kind) {
        res.status(400).json({ ok: false, error: 'Unknown memory section' })
        return
      }
      const item = await updateMemoryItem(kind, String(req.params.id), {
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        body: typeof req.body?.body === 'string' ? req.body.body : undefined,
        pinned: typeof req.body?.pinned === 'boolean' ? req.body.pinned : undefined,
      })
      if (!item) {
        res.status(404).json({ ok: false, error: 'Item not found' })
        return
      }
      res.json({ ok: true, item })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.post('/api/artemis/memory/:kind/:id/pin', async (req, res) => {
    try {
      const kind = parseKind(String(req.params.kind))
      if (!kind) {
        res.status(400).json({ ok: false, error: 'Unknown memory section' })
        return
      }
      const item = await updateMemoryItem(kind, String(req.params.id), { pinned: true })
      if (!item) {
        res.status(404).json({ ok: false, error: 'Item not found' })
        return
      }
      res.json({ ok: true, item })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.delete('/api/artemis/memory/:kind/:id', async (req, res) => {
    try {
      const kind = parseKind(String(req.params.kind))
      if (!kind) {
        res.status(400).json({ ok: false, error: 'Unknown memory section' })
        return
      }
      const ok = await forgetMemoryItem(kind, String(req.params.id))
      if (!ok) {
        res.status(404).json({ ok: false, error: 'Item not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.get('/api/artemis/memory/:kind/:id/export', async (req, res) => {
    try {
      const kind = parseKind(String(req.params.kind))
      if (!kind) {
        res.status(400).json({ ok: false, error: 'Unknown memory section' })
        return
      }
      if (kind === 'conversations') {
        const conv = await readConversation(String(req.params.id))
        if (!conv) {
          res.status(404).json({ ok: false, error: 'Item not found' })
          return
        }
        res.json({ ok: true, kind, item: conv })
        return
      }
      const board = await loadMemoryBoard()
      const item = board[kind].find((i) => i.id === String(req.params.id))
      if (!item) {
        res.status(404).json({ ok: false, error: 'Item not found' })
        return
      }
      res.json({ ok: true, kind, item })
    } catch (err) {
      sendError(res, err)
    }
  })

  app.post('/api/artemis/files', async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
      if (!name) {
        res.status(400).json({ ok: false, error: 'name is required' })
        return
      }
      const item = await addMemoryItem('files', name, `Attached in The Bow · ${name}`)
      res.status(201).json({ ok: true, item })
    } catch (err) {
      sendError(res, err)
    }
  })
}
