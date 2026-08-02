# Cutline Content Engine

AI + Replit + AWS + YouTube/AdSense execution loop: trends → scripts → assets → publish → cash.

## 1. AI stack (content creation & automation)

| Job | What Cutline uses it for |
|---|---|
| Script & concepting | Video ideas, title hooks, SEO keywords, full 8–10 min gaming scripts |
| Voiceovers & audio | AI TTS when not recording live; loudness-normalized WAV/MP3 |
| Visual assets | Thumbnail concepts, channel art, B-roll stills/animations |

## 2. Replit (rapid prototyping & workflow automation)

- **API integration** — Python/Node workers for YouTube API (trending, views, keyword performance)
- **Automated pipelines** — descriptions, tags, timestamp chapters, social promo posts
- **Webhooks & bots** — Discord/Telegram alerts for gaming news; scheduled publish helpers

Local/repo equivalents live under `scripts/replit/` and Autopilot (`npm run autopilot`).

## 3. AWS (scalable backend & storage)

| Service | Role |
|---|---|
| **S3** | Raw footage, thumbs, audio, exports (`scripts/aws/media_bootstrap.sh`) |
| **Lambda / EC2** | Headless FFmpeg / Autopilot render jobs |
| **DynamoDB / RDS** | Pipeline status, analytics logs, content job state |

## 4. Google AdSense & monetization

- **YPP** — after 1,000 subs + 4,000 public watch hours *or* 10M Short views; AdSense payouts from YouTube
- **Companion site** — guides/blog on `cutline-industries.studio` with AdSense for search traffic outside YouTube

Stripe packs remain the near-term cash path while YPP ramps (see `docs/MONEY-NOW.md`).

## Suggested execution workflow

1. **Pipeline creation (Replit)** — scan gaming subreddits/news/YouTube API for topics  
2. **Content generation (AI)** — 8–10 min script + titles/thumbs  
3. **Asset management (AWS)** — upload audio/video to S3; process with FFmpeg jobs  
4. **Publish & monetize** — schedule uploads, optimize metadata, YPP + site AdSense  

OS UI: `/os/pipeline`
