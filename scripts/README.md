# Cutline automation scripts

## Replit — trend radar
```bash
python scripts/replit/trend_radar.py --subreddit gaming --limit 20
```
Writes `inbox/trend_queue.json`.

## AI — script factory
```bash
# offline template (no key required)
python scripts/ai/script_factory.py --topic "Rank reset survival guide"

# live model
export OPENAI_API_KEY=...
python scripts/ai/script_factory.py --topic "Rank reset survival guide" --keywords "rank,reset,climb"
```
Writes `inbox/script_package.json`.

## AWS — media bootstrap
```bash
chmod +x scripts/aws/media_bootstrap.sh
CUTLINE_MEDIA_BUCKET=your-bucket ./scripts/aws/media_bootstrap.sh create-bucket
CUTLINE_MEDIA_BUCKET=your-bucket ./scripts/aws/media_bootstrap.sh sync-inbox
```

## End-to-end loop
1. Replit/script trend radar → topics
2. AI script factory → titles/script/Shorts plan
3. AWS S3 + FFmpeg Autopilot → assets
4. YouTube publish + site AdSense → money
