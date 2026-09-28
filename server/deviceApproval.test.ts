import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { defaultNtfyTopic } from './deviceApproval.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TOPIC_PATH = path.join(ROOT, 'secrets', 'approval-topic.txt')
const ORIGINAL = {
  CUTLINE_NTFY_TOPIC: process.env.CUTLINE_NTFY_TOPIC,
  CUTLINE_APPROVAL_PAIR_SECRET: process.env.CUTLINE_APPROVAL_PAIR_SECRET,
}
const existingTopic = existsSync(TOPIC_PATH) ? readFileSync(TOPIC_PATH, 'utf8') : null

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  if (existingTopic === null) {
    if (existsSync(TOPIC_PATH)) unlinkSync(TOPIC_PATH)
    return
  }

  mkdirSync(path.dirname(TOPIC_PATH), { recursive: true })
  writeFileSync(TOPIC_PATH, existingTopic)
})

describe('defaultNtfyTopic', () => {
  it('prefers an explicit topic override', () => {
    process.env.CUTLINE_NTFY_TOPIC = 'cutline-thermal-custom-name'
    process.env.CUTLINE_APPROVAL_PAIR_SECRET = 'existing-secret'

    assert.equal(defaultNtfyTopic(), 'cutline-thermal-custom-name')
  })

  it('generates and persists a topic instead of hashing the pair secret', () => {
    delete process.env.CUTLINE_NTFY_TOPIC
    process.env.CUTLINE_APPROVAL_PAIR_SECRET = 'existing-secret'
    if (existsSync(TOPIC_PATH)) unlinkSync(TOPIC_PATH)

    const topic = defaultNtfyTopic()

    assert.match(topic, /^cutline-thermal-[a-f0-9]{12}$/)
    assert.notEqual(topic, 'cutline-thermal-06d11b54b829')
    assert.equal(readFileSync(TOPIC_PATH, 'utf8').trim(), topic)

    process.env.CUTLINE_APPROVAL_PAIR_SECRET = 'different-existing-secret'
    assert.equal(defaultNtfyTopic(), topic)
  })
})
