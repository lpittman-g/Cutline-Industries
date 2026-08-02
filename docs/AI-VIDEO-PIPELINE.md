# AI video pipeline

Cutline can **create Shorts from scratch** — no gameplay VOD required.

## Flow

```
trend_radar.py → script_factory.py → voice_factory.py → FFmpeg render → YouTube upload
```

1. **Trend radar** — scans Reddit (or demo seeds) → `inbox/trend_queue.json`
2. **Script factory** — titles, hooks, script, Shorts cutdowns → `inbox/script_package.json`
3. **Voice factory** — Edge TTS (free) or OpenAI TTS → `ai_out/*/voice_*.mp3`
4. **Render** — vertical 1080×1920 slideshow with title + hook overlays → `ai_out/*/*.mp4`
5. **Upload** — existing YouTube Autopilot uploader (private by default)

## Run once

```bash
npm run ai:pipeline:once
```

## Run continuously (every 5 min by default)

```bash
npm run ai:pipeline
```

Or via API:

```bash
curl -X POST http://127.0.0.1:8787/api/ai-pipeline/run-once
curl http://127.0.0.1:8787/api/ai-pipeline/status
```

## Environment

See `.env.example` — key vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `CUTLINE_AI_MAX_SHORTS` | `3` | Shorts per topic |
| `CUTLINE_AI_TOPICS_PER_RUN` | `1` | New topics per cycle |
| `CUTLINE_AI_POLL_MS` | `300000` | Daemon poll interval |
| `CUTLINE_TREND_SUBREDDIT` | `gaming` | Reddit source |
| `CUTLINE_TTS_VOICE` | `en-US-GuyNeural` | Edge TTS voice |
| `OPENAI_API_KEY` | — | Optional: GPT scripts + OpenAI TTS |

## Dependencies

- **Python 3** + `edge-tts` (`pip install edge-tts`)
- **ffmpeg** / **ffprobe** on PATH
- **YouTube OAuth** — `token.json` (same as VOD Autopilot)

## Output

- Videos: `ai_out/<topic-hash>/`
- State: `ai-pipeline-state.json`
- Log: `ai-pipeline.log`

## VOD Autopilot vs AI pipeline

| | VOD Autopilot | AI pipeline |
|---|---------------|-------------|
| Input | `inbox/*.mp4` gameplay | Trend topics |
| Command | `npm run autopilot` | `npm run ai:pipeline` |
| Best for | Clip highlights from streams | Daily faceless Shorts from trends |

Both can run in parallel.
