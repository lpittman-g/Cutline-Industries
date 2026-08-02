#!/usr/bin/env python3
"""Cutline AI voiceover factory.

Uses Microsoft Edge TTS (free, no API key) by default.
Falls back to OpenAI TTS when OPENAI_API_KEY is set and --engine openai.

Usage:
  python scripts/ai/voice_factory.py --text "Most players do this wrong every reset." --out inbox/voice.mp3
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import urllib.request
from pathlib import Path


DEFAULT_VOICE = "en-US-GuyNeural"


async def edge_tts(text: str, out_path: Path, voice: str) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))


def openai_tts(text: str, out_path: Path) -> None:
    api_key = os.environ["OPENAI_API_KEY"]
    body = {
        "model": os.environ.get("OPENAI_TTS_MODEL", "tts-1"),
        "input": text,
        "voice": os.environ.get("OPENAI_TTS_VOICE", "onyx"),
        "response_format": "mp3",
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        out_path.write_bytes(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "inbox" / "voice.mp3"),
    )
    parser.add_argument("--voice", default=os.environ.get("CUTLINE_TTS_VOICE", DEFAULT_VOICE))
    parser.add_argument(
        "--engine",
        default=os.environ.get("CUTLINE_TTS_ENGINE", "edge"),
        choices=["edge", "openai"],
    )
    args = parser.parse_args()

    text = args.text.strip()
    if not text:
        raise SystemExit("Empty narration text")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.engine == "openai" and os.environ.get("OPENAI_API_KEY"):
        openai_tts(text, out)
        mode = "openai-tts"
    else:
        asyncio.run(edge_tts(text, out, args.voice))
        mode = "edge-tts"

    print(json.dumps({"mode": mode, "out": str(out), "chars": len(text)}))


if __name__ == "__main__":
    main()
