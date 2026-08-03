# AI video pipeline

Cutline creates **Cutline Industries** Shorts as optional distribution — not a gaming channel brand.

## Project mode (default)

`CUTLINE_AI_MODE=project` uses dedicated product topics:

- How Thermal turns chat heat into Shorts
- $15 live Discord unlocks
- Bounty Board bundles
- Indie dev ad retainers
- Cutline API + FFmpeg engine

Scripts come from `scripts/ai/project_script_factory.py` and always promote Thermal.

## Feedback loop

Before each run the pipeline:

1. Fetches **YouTube views, likes, and comments** on published AI Shorts
2. Reads **audience inputs** from `/feedback` and the API
3. Writes `inbox/feedback_report.json` with winning hooks and next topic suggestions
4. Biases the next script batch toward what performed and what people asked for

### Public input

- **Page:** `/feedback` on the public site
- **API:** `POST /api/ai-pipeline/feedback` `{ "message": "..." }`
- **Refresh analytics:** `POST /api/ai-pipeline/feedback/refresh`

## Privacy

Project Shorts upload as **`public`** by default (`CUTLINE_AI_PRIVACY=public`).
VOD Autopilot clips still use `CUTLINE_PRIVACY`.

## Run

```bash
pip install edge-tts
npm run ai:pipeline:once
npm run ai:pipeline
```

## Modes

| `CUTLINE_AI_MODE` | Behavior |
|-------------------|----------|
| `project` (default) | Thermal/Cutline product Shorts + feedback loop |
| `trends` | Generic Reddit gaming topics (legacy) |
