/**
 * /api/chat — simple chat endpoint backed by the self-hosted Artemis engine.
 *
 * Accepts the same { messages } payload shape as standard chat APIs so
 * external tools can call it without knowing about Artemis internals.
 * All inference goes through artemis-serve:8100 — no external LLM calls.
 */
import type { Express, Request, Response } from 'express'
import {
  runArtemis,
  loadRelevantMemory,
  ensureArtemisData,
  getActiveVoice,
  DEFAULT_VOICE,
} from './artemis/store.ts'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
}

export function registerChatRoute(app: Express) {
  app.post('/api/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response): Promise<void> => {
    try {
      const { messages } = req.body

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Invalid payload. 'messages' array required." })
        return
      }

      // Extract the latest user message for Artemis
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) {
        res.status(400).json({ error: 'No user message found in messages array.' })
        return
      }

      await ensureArtemisData()
      const voice = await getActiveVoice().catch(() => DEFAULT_VOICE)
      const context = await loadRelevantMemory(lastUser.content)

      const reply = await runArtemis({
        message: lastUser.content,
        context,
        voice,
      })

      res.json({ reply })
    } catch (error) {
      console.error('[/api/chat] Artemis error:', error)
      res.status(500).json({ error: 'Internal Server Error during AI computation.' })
    }
  })
}
