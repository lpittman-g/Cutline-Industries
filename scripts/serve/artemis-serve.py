#!/usr/bin/env python3
"""
Artemis inference server — CPU/GPU, no H100 required.

Loads the trained checkpoint from ARTEMIS_MODEL_PATH (local path or HuggingFace
model ID), then serves the same /v1/chat API the application already expects.

Supported hardware:
  CPU only   4–8 GB RAM   GPT-2 base/med   ~1–4 tok/s
  T4 GPU    16 GB VRAM   GPT-2-XL / 1.5B  ~20–60 tok/s    (~$0.35/hr spot)
  A10G GPU  24 GB VRAM   up to 7B         ~40–100 tok/s   (~$1.50/hr spot)

Environment variables:
  ARTEMIS_MODEL_PATH   path or HF model ID  (default: "./artemis-checkpoint")
  ARTEMIS_DTYPE        float32|float16|bfloat16  (default: auto)
  ARTEMIS_DEVICE       cpu|cuda|auto  (default: auto)
  ARTEMIS_MAX_TOKENS   max new tokens per response  (default: 512)
  ARTEMIS_PORT         HTTP port  (default: 8100)
  ARTEMIS_API_KEY      optional bearer auth (leave unset for internal use)

Usage:
  pip install torch transformers accelerate
  ARTEMIS_MODEL_PATH=./artemis-checkpoint python scripts/serve/artemis-serve.py

  # Or with a T4/A10G GPU via vLLM:
  pip install vllm
  ARTEMIS_MODEL_PATH=./artemis-checkpoint python scripts/serve/vllm-launch.py
"""
from __future__ import annotations

import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

MODEL_PATH: str = os.environ.get("ARTEMIS_MODEL_PATH", "./artemis-checkpoint")
DTYPE_ENV: str = os.environ.get("ARTEMIS_DTYPE", "auto")
DEVICE_ENV: str = os.environ.get("ARTEMIS_DEVICE", "auto")
MAX_TOKENS: int = int(os.environ.get("ARTEMIS_MAX_TOKENS", "512"))
PORT: int = int(os.environ.get("ARTEMIS_PORT", "8100"))
API_KEY: str = os.environ.get("ARTEMIS_API_KEY", "")

BRAINS = [
    {"id": "apollo",   "name": "Apollo",   "title": "Navigator",           "kind": "specialist",   "role": "Roadmaps, planning, strategy and business direction."},
    {"id": "artemis",  "name": "Artemis",  "title": "",                    "kind": "orchestrator", "role": "The big brain. Routes, synthesizes, and answers."},
    {"id": "earth",    "name": "Earth",    "title": "Voice",               "kind": "specialist",   "role": "Voice and conversation."},
    {"id": "jupiter",  "name": "Jupiter",  "title": "Multimodal",          "kind": "specialist",   "role": "Images, screenshots, charts and documents."},
    {"id": "mars",     "name": "Mars",     "title": "Shipping",            "kind": "specialist",   "role": "Execution and go/no-go decisions."},
    {"id": "mercury",  "name": "Mercury",  "title": "Memory",              "kind": "specialist",   "role": "Memory and continuity."},
    {"id": "neptune",  "name": "Neptune",  "title": "Deep research",       "kind": "specialist",   "role": "Research, evidence, and cited summaries."},
    {"id": "pluto",    "name": "Pluto",    "title": "Systems architecture","kind": "specialist",   "role": "Infrastructure, data flows, and cloud architecture."},
    {"id": "saturn",   "name": "Saturn",   "title": "Code",                "kind": "specialist",   "role": "Writes, fixes, explains and tests code."},
    {"id": "uranus",   "name": "Uranus",   "title": "Math and logic",      "kind": "specialist",   "role": "Math, calculation, statistics, logical reasoning."},
    {"id": "venus",    "name": "Venus",    "title": "Auditor",             "kind": "specialist",   "role": "Checks every brain's work before Artemis answers."},
]

KEYWORD_ROUTES: dict[str, list[str]] = {
    "pluto":   ["architecture", "infrastructure", "cloud", "deploy", "docker", "kubernetes", "database", "schema"],
    "saturn":  ["code", "function", "bug", "python", "javascript", "typescript", "error", "script"],
    "neptune": ["research", "find", "search", "source", "evidence", "compare", "study"],
    "apollo":  ["plan", "strategy", "roadmap", "goal", "milestone", "direction", "business"],
    "mercury": ["remember", "recall", "history", "memory", "past", "before"],
    "mars":    ["ship", "launch", "release", "ready", "checklist", "production", "deploy"],
    "uranus":  ["math", "calculate", "statistics", "probability", "proof", "equation", "logic"],
    "jupiter": ["image", "screenshot", "chart", "document", "visual", "picture"],
    "earth":   ["speak", "voice", "say", "tone", "write", "conversation"],
    "venus":   ["check", "verify", "audit", "review", "correct", "valid"],
}


def route_to_brain(message: str) -> tuple[str, str]:
    lower = message.lower()
    for brain_id, keywords in KEYWORD_ROUTES.items():
        for kw in keywords:
            if kw in lower:
                return brain_id, kw
    return "artemis", "direct"


# ── model loading ─────────────────────────────────────────────────────────────

_model = None
_tokenizer = None
_device = "cpu"
_serving = False
_load_error: str = ""


def _load_model() -> bool:
    global _model, _tokenizer, _device, _serving, _load_error
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        # Device selection
        if DEVICE_ENV == "auto":
            _device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            _device = DEVICE_ENV

        # Dtype selection
        dtype_map = {"float32": torch.float32, "float16": torch.float16, "bfloat16": torch.bfloat16}
        if DTYPE_ENV == "auto":
            dtype = torch.float16 if _device == "cuda" else torch.float32
        else:
            dtype = dtype_map.get(DTYPE_ENV, torch.float32)

        print(f"[artemis-serve] Loading model from: {MODEL_PATH}")
        print(f"[artemis-serve] Device: {_device}, Dtype: {dtype}")

        _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        if _tokenizer.pad_token is None:
            _tokenizer.pad_token = _tokenizer.eos_token

        _model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            torch_dtype=dtype,
            device_map="auto" if _device == "cuda" else None,
            low_cpu_mem_usage=True,
        )
        if _device == "cpu":
            _model = _model.to("cpu")

        _model.eval()
        _serving = True

        # Warmup
        print("[artemis-serve] Warming up…")
        _infer("Hello, Artemis.")
        print(f"[artemis-serve] Ready on port {PORT}")
        return True

    except Exception as exc:
        _load_error = str(exc)
        print(f"[artemis-serve] Load failed: {exc}")
        return False


def _infer(message: str, system: str = "") -> tuple[str, float]:
    import torch

    t0 = time.perf_counter()
    prompt = f"<|system|>{system}\n<|user|>{message}\n<|assistant|>" if system else f"User: {message}\nArtemis:"
    inputs = _tokenizer(prompt, return_tensors="pt").to(_device)
    with torch.no_grad():
        out = _model.generate(
            **inputs,
            max_new_tokens=MAX_TOKENS,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=_tokenizer.eos_token_id,
        )
    # Decode only the new tokens
    new_ids = out[0][inputs["input_ids"].shape[-1]:]
    text = _tokenizer.decode(new_ids, skip_special_tokens=True).strip()
    latency_ms = round((time.perf_counter() - t0) * 1000)
    return text, latency_ms


# ── HTTP server ───────────────────────────────────────────────────────────────

def _json(handler: "ArtemisHandler", code: int, data: Any) -> None:
    body = json.dumps(data).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class ArtemisHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quieter logs
        print(f"[artemis-serve] {self.address_string()} {fmt % args}")

    def _check_auth(self) -> bool:
        if not API_KEY:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {API_KEY}"

    def do_GET(self) -> None:
        if self.path == "/v1/status":
            _json(self, 200, {
                "serving": _serving,
                "device": _device,
                "model": MODEL_PATH,
                "load_error": _load_error or None,
                "tiers": ["gpt-1-base", "gpt-2-sft", "gpt-3-aligned-rag"],
                "tools": {"web_search": "wikipedia", "web_fetch": True, "run_python": "azure-dynamic-sessions"},
            })
        elif self.path == "/v1/brains":
            _json(self, 200, {"brains": BRAINS})
        else:
            _json(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        if not self._check_auth():
            _json(self, 401, {"error": "unauthorized"})
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            req: dict = json.loads(body)
        except Exception:
            _json(self, 400, {"error": "invalid json"})
            return

        if self.path == "/v1/chat":
            message: str = req.get("message", "").strip()
            if not message:
                _json(self, 400, {"error": "message required"})
                return

            brain_id, reason_kw = route_to_brain(message)

            if not _serving:
                _json(self, 200, {
                    "status": "training",
                    "answer": "Artemis is still training; chat opens when the first model passes evaluation.",
                    "brains": [brain_id],
                    "router": "keyword",
                    "reason": f"{brain_id}: {reason_kw}",
                    "audit": None,
                    "latency_ms": 0,
                    "memories_used": 0,
                    "tools_used": [],
                    "plan": "free",
                    "tier": req.get("tier", "gpt-2-sft"),
                })
                return

            system = (
                "You are Artemis, a proprietary AI assistant built by Cutline Industries. "
                "Be concise, direct, and helpful. Do not mention OpenAI, Claude, or any other AI product."
            )
            answer, latency_ms = _infer(message, system)

            _json(self, 200, {
                "status": "ok",
                "answer": answer,
                "brains": [brain_id],
                "router": "keyword",
                "reason": f"{brain_id}: {reason_kw}",
                "audit": None,
                "latency_ms": latency_ms,
                "memories_used": 0,
                "tools_used": [],
                "plan": "free",
                "tier": req.get("tier", "gpt-2-sft"),
            })
        else:
            _json(self, 404, {"error": "not found"})


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _load_model()  # blocks until loaded or fails
    server = HTTPServer(("0.0.0.0", PORT), ArtemisHandler)
    print(f"[artemis-serve] Listening on 0.0.0.0:{PORT}  serving={_serving}")
    server.serve_forever()
