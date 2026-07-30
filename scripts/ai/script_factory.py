#!/usr/bin/env python3
"""Cutline AI script factory (works with OpenAI-compatible APIs).

If OPENAI_API_KEY is missing, writes a high-quality offline template script
so the pipeline never blocks.

Usage:
  python scripts/ai/script_factory.py --topic "Rank reset survival guide"
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def offline_script(topic: str, keywords: list[str]) -> dict:
    return {
        "topic": topic,
        "titles": [
            f"{topic}: What Actually Works",
            f"Stop Losing Rank — {topic}",
            f"{topic} in Under 10 Minutes",
        ],
        "hooks": [
            "Most players do this wrong every reset.",
            "If your placements feel random, watch this.",
            "One habit separates stuck players from climbers.",
        ],
        "keywords": keywords or [w for w in topic.lower().split() if len(w) > 3][:6],
        "chapters": [
            "0:00 Hook",
            "0:20 Why this matters",
            "2:00 Framework",
            "7:00 Payoff clip",
            "8:30 CTA",
        ],
        "script": f"""# {topic}

## Hook
Most players lose because they skip the basics behind {topic}.

## Context
Here's the current meta pressure and why this week matters.

## Framework
1. Diagnose the mistake
2. Install the correct habit with a clear example
3. Run a 10-minute drill after the video

## Payoff
Show the before/after clip and recap checklist.

## CTA
Subscribe for daily Shorts and grab the full pack on cutline-industries.studio.
""",
        "shorts_cutdowns": ["Hook", "Mistake vs fix", "Drill", "Payoff"],
        "mode": "offline-template",
    }


def openai_script(topic: str, keywords: list[str]) -> dict:
    api_key = os.environ["OPENAI_API_KEY"]
    body = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": "You are Cutline Industries' gaming content strategist. Return compact JSON.",
            },
            {
                "role": "user",
                "content": (
                    f"Create a YouTube package for topic: {topic}. Keywords: {', '.join(keywords)}. "
                    "Return JSON keys: titles (3), hooks (3), keywords, chapters, script, shorts_cutdowns."
                ),
            },
        ],
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    content = payload["choices"][0]["message"]["content"]
    data = json.loads(content)
    data["mode"] = "openai"
    data["topic"] = topic
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", required=True)
    parser.add_argument("--keywords", default="")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "inbox" / "script_package.json"),
    )
    args = parser.parse_args()
    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]

    package = (
        openai_script(args.topic, keywords)
        if os.environ.get("OPENAI_API_KEY")
        else offline_script(args.topic, keywords)
    )
    package["generated_at"] = datetime.now(timezone.utc).isoformat()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(package, indent=2))
    print(f"Wrote script package ({package.get('mode')}) → {out}")


if __name__ == "__main__":
    main()
