#!/usr/bin/env python3
"""Cutline / Thermal project script factory.

Generates Shorts scripts dedicated to the Thermal product — not generic gaming.
Reads optional feedback from inbox/feedback_report.json and audience_inputs.json.

Usage:
  python scripts/ai/project_script_factory.py --topic-id thermal-heat
  python scripts/ai/project_script_factory.py --title "Custom project angle"
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEEDBACK_PATH = ROOT / "inbox" / "feedback_report.json"
INPUTS_PATH = ROOT / "inbox" / "audience_inputs.json"

PROJECT = {
    "brand": "Cutline Industries",
    "product": "Thermal",
    "tagline": "Turn live stream heat into monetized Shorts",
    "site": "cutline-industries.studio",
}


def load_json(path: Path, default: dict | list) -> dict | list:
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def offline_project_script(topic: str, keywords: list[str], feedback: dict, inputs: list) -> dict:
    audience = [i.get("message", "") for i in inputs[-5:] if i.get("message")]
    winning_hooks = feedback.get("winning_hooks") or [
        "Stream chat just told you a clip is worth money.",
        "Heat spikes happen before virality — here's how Thermal catches them.",
        "Your best moment might be buried in a 4-hour VOD.",
    ]
    hooks = winning_hooks[:3] if winning_hooks else [
        f"{PROJECT['product']} turns chat velocity into revenue.",
        "Most streamers miss their highest-RPM moments.",
        "One heat spike. One Short. One payout.",
    ]
    if audience:
        hooks[0] = f"You asked: {audience[-1][:80]}"

    titles = [
        f"{PROJECT['product']}: {topic[:60]}",
        f"Stop sleeping on stream heat — {topic[:45]}",
        f"{topic[:70]} | {PROJECT['brand']}",
    ]
    kw = keywords or ["Thermal", "Shorts", "streaming", "Cutline"]
    return {
        "topic": topic,
        "project": PROJECT,
        "titles": titles,
        "hooks": hooks,
        "keywords": kw,
        "chapters": ["0:00 Hook", "0:15 Problem", "0:35 Thermal solution", "0:50 CTA"],
        "script": f"""# {topic}

## Hook
{hooks[0]}

## Problem
Creators leave money on the table when chat spikes but nobody clips, edits, or publishes fast enough.

## Solution
{PROJECT['product']} by {PROJECT['brand']} detects heat in real time, cuts vertical Shorts with Cutline + FFmpeg, and monetizes via unlocks, bounties, and YPP.

## Proof
Tier 1: $15 live Discord unlock. Tier 2: $50 bounty bundles. Tier 3: indie dev ad retainers.

## CTA
Visit {PROJECT['site']} — {topic.split('—')[0].strip()}.
""",
        "shorts_cutdowns": ["Hook", "Problem", "Solution", "CTA"],
        "mode": "project-offline",
    }


def openai_project_script(topic: str, keywords: list[str], feedback: dict, inputs: list) -> dict:
    api_key = os.environ["OPENAI_API_KEY"]
    audience = [i.get("message", "") for i in inputs[-5:] if i.get("message")]
    prompt = (
        f"Create a YouTube Shorts package for {PROJECT['brand']}'s product {PROJECT['product']}. "
        f"Topic: {topic}. Keywords: {', '.join(keywords)}. "
        f"Tagline: {PROJECT['tagline']}. Site: {PROJECT['site']}. "
        f"Winning hooks from analytics: {json.dumps(feedback.get('winning_hooks', [])[:3])}. "
        f"Audience requests: {json.dumps(audience)}. "
        "Return JSON: titles (3), hooks (3), keywords, chapters, script, shorts_cutdowns. "
        "Every line must promote Thermal/Cutline — no generic gaming tips."
    )
    body = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": "You are Cutline Industries' product marketer. Return compact JSON only."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    data = json.loads(payload["choices"][0]["message"]["content"])
    data["mode"] = "project-openai"
    data["topic"] = topic
    data["project"] = PROJECT
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic-id", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--keywords", default="")
    parser.add_argument(
        "--out",
        default=str(ROOT / "inbox" / "script_package.json"),
    )
    args = parser.parse_args()

    feedback = load_json(FEEDBACK_PATH, {})
    inputs = load_json(INPUTS_PATH, [])

    topic = args.title.strip()
    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]

    if not topic and args.topic_id:
        topics_path = ROOT / "server" / "projectTopics.json"
        if topics_path.exists():
            catalog = json.loads(topics_path.read_text())
            match = next((t for t in catalog if t["id"] == args.topic_id), None)
            if match:
                topic = match["title"]
                keywords = match.get("keywords", keywords)

    if not topic:
        raise SystemExit("Provide --title or --topic-id")

    package = (
        openai_project_script(topic, keywords, feedback, inputs)
        if os.environ.get("OPENAI_API_KEY")
        else offline_project_script(topic, keywords, feedback, inputs)
    )
    package["generated_at"] = datetime.now(timezone.utc).isoformat()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(package, indent=2))
    print(f"Wrote project script ({package.get('mode')}) → {out}")


if __name__ == "__main__":
    main()
