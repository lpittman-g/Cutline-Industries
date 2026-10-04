// Vercel serverless entry — wraps the Express app as a handler.
// All /api/* requests are rewritten here by vercel.json.
import { createApp } from '../server/createApp.ts'

export default createApp()
