#!/usr/bin/env python3
"""Cutline trend radar stub — run on Replit or locally.

Scans public Reddit JSON + optional YouTube Data API for gaming topics,
then prints a ranked queue the AI script step can consume.

Env:
  YOUTUBE_API_KEY   optional
  REDDIT_SUBS       comma list (default: competitive,gaming,OutOfTheLoop)
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass


@dataclass
class Topic:
    title: str
    source: str
    score: int
    keywords: list[str]
    angle: str


def fetch_reddit(sub: str, limit: int = 8) -> list[Topic]:
    url = f"https://www.reddit.com/r/{sub}/hot.json?limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "cutline-trend-radar/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    out: list[Topic] = []
    for child in payload.get("data", {}).get("children", []):
        data = child.get("data", {})
        title = (data.get("title") or "").strip()
        if not title:
            continue
        score = int(data.get("score") or 0)
        words = [w.strip(".,!?:;\"'").lower() for w in title.split() if len(w) > 3][:5]
        out.append(
            Topic(
                title=title[:120],
                source=f"reddit r/{sub}",
                score=min(99, 50 + score // 50),
                keywords=words or ["gaming"],
                angle="News explainer + Shorts cutdowns",
            )
        )
    return out


def fetch_youtube_trending(api_key: str) -> list[Topic]:
    # Gaming category id = 20
    qs = urllib.parse.urlencode(
        {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": "US",
            "videoCategoryId": "20",
            "maxResults": "8",
            "key": api_key,
        }
    )
    url = f"https://www.googleapis.com/youtube/v3/videos?{qs}"
    with urllib.request.urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    out: list[Topic] = []
    for item in payload.get("items", []):
        sn = item.get("snippet", {})
        stats = item.get("statistics", {})
        title = (sn.get("title") or "").strip()
        views = int(stats.get("viewCount") or 0)
        tags = (sn.get("tags") or [])[:5]
        out.append(
            Topic(
                title=title[:120],
                source="YouTube API trending/gaming",
                score=min(99, 60 + views // 500_000),
                keywords=tags or ["gaming", "trending"],
                angle="8–10 min tutorial + 10 Shorts",
            )
        )
    return out


def main() -> None:
    subs = [s.strip() for s in os.getenv("REDDIT_SUBS", "competitive,gaming").split(",") if s.strip()]
    topics: list[Topic] = []
    for sub in subs:
        try:
            topics.extend(fetch_reddit(sub))
        except Exception as exc:  # noqa: BLE001 — stub should keep running
            print(json.dumps({"warn": f"reddit/{sub}", "error": str(exc)}))

    yt_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if yt_key:
        try:
            topics.extend(fetch_youtube_trending(yt_key))
        except Exception as exc:  # noqa: BLE001
            print(json.dumps({"warn": "youtube", "error": str(exc)}))

    topics.sort(key=lambda t: t.score, reverse=True)
    # de-dupe by title
    seen: set[str] = set()
    unique: list[Topic] = []
    for t in topics:
        key = t.title.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(t)

    print(json.dumps({"brand": "Cutline Industries", "count": len(unique), "topics": [asdict(t) for t in unique[:20]]}, indent=2))


if __name__ == "__main__":
    main()
