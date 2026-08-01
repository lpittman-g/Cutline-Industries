#!/usr/bin/env python3
"""Cutline trend radar (Replit-friendly).

Scans public Reddit JSON for gaming trend seeds and writes a topic queue
the AI script stage can consume.

Usage:
  python scripts/replit/trend_radar.py
  python scripts/replit/trend_radar.py --subreddit competitiveaimlabs --limit 15
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


UA = "CutlineTrendRadar/1.0 (creator-os)"


def demo_posts(subreddit: str, limit: int = 20) -> list[dict]:
    seeds = [
        "Rank reset survival guide for climbing fast",
        "Patch notes that quietly broke the meta",
        "One habit separating diamond from immortal",
        "Best beginner loadouts this week",
        "Clutch drills you can practice in 10 minutes",
        "Why your crosshair placement is leaking elo",
        "Utility lineups that still work after nerfs",
        "VOD review mistakes that keep you hardstuck",
    ]
    posts = []
    for i, title in enumerate(seeds[:limit]):
        posts.append(
            {
                "id": f"demo{i}",
                "title": title,
                "score": 900 - i * 70,
                "comments": 120 - i * 8,
                "url": f"https://cutline-industries.studio/pipeline?demo={i}",
                "subreddit": subreddit,
                "demo": True,
            }
        )
    return posts


def fetch_subreddit(subreddit: str, limit: int = 20) -> list[dict]:
    url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.load(resp)
    except Exception as exc:  # noqa: BLE001 - keep Replit pipeline unblocked
        print(f"Live fetch blocked ({exc}); using demo trend seeds")
        return demo_posts(subreddit, limit)
    posts = []
    for child in payload.get("data", {}).get("children", []):
        data = child.get("data", {})
        posts.append(
            {
                "id": data.get("id"),
                "title": data.get("title"),
                "score": data.get("score", 0),
                "comments": data.get("num_comments", 0),
                "url": f"https://reddit.com{data.get('permalink', '')}",
                "subreddit": subreddit,
            }
        )
    return posts


def rank(posts: list[dict]) -> list[dict]:
    ranked = sorted(posts, key=lambda p: (p["score"] + p["comments"] * 2), reverse=True)
    for i, post in enumerate(ranked):
        post["trend_score"] = min(99, int((post["score"] + post["comments"] * 2) ** 0.5 * 3))
        post["angle"] = f"Turn into 8-10 min guide + Shorts cutdowns: {post['title'][:80]}"
    return ranked


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subreddit", default="gaming")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "inbox" / "trend_queue.json"),
    )
    args = parser.parse_args()

    posts = rank(fetch_subreddit(args.subreddit, args.limit))
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": f"reddit:r/{args.subreddit}",
        "topics": posts[: args.limit],
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out['topics'])} topics → {out_path}")


if __name__ == "__main__":
    main()
