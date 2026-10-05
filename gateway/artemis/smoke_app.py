"""Real-deployment smoke check. Reads login credentials from environment, never CLI arguments.

ARTEMIS_SMOKE_EMAIL / ARTEMIS_SMOKE_PASSWORD must belong to an existing account.
python -m artemis.smoke_app --url https://YOUR-SITE [--with-python]
Creates one conversation and consumes normal message/tool quotas.
"""
import argparse
import http.cookiejar
import json
import os
import secrets
import time
import urllib.error
import urllib.request


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--with-python", action="store_true")
    args = parser.parse_args(argv)
    base = args.url.rstrip("/")
    if not base.startswith("https://") and not base.startswith(("http://localhost:", "http://127.0.0.1:")):
        parser.error("Use HTTPS except for a loopback development server.")
    email, password = os.environ.get("ARTEMIS_SMOKE_EMAIL"), os.environ.get("ARTEMIS_SMOKE_PASSWORD")
    if not email or not password: parser.error("Set ARTEMIS_SMOKE_EMAIL and ARTEMIS_SMOKE_PASSWORD securely in the shell environment.")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    csrf = ""
    def request(path, body=None):
        req = urllib.request.Request(base+path, data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **({"X-CSRF-Token": csrf} if csrf else {})})
        with opener.open(req, timeout=30) as response: return json.load(response)
    def turn(cid, text):
        result = request("/api/conversations/"+cid+"/messages", {"text": text, "idempotency_key": secrets.token_hex(16)})
        deadline, cursor, seen = time.monotonic()+180, 0, []
        while time.monotonic() < deadline:
            events = request("/api/requests/"+result["request_id"]+"/events?after="+str(cursor))
            for chunk in events["events"]: cursor = chunk["seq"]; seen.append(chunk["event"])
            if events["state"] not in ("queued", "generating"):
                if not seen or seen[-1]["type"] != "done": raise ValueError("The real model did not complete the request: "+events["state"])
                return seen[-1]["answer"], seen
            time.sleep(.2)
        raise ValueError("The real model did not complete before the smoke-check deadline.")
    try:
        csrf = request("/api/auth/login", {"email": email, "password": password})["user"]["csrf"]
        status = request("/api/status")
        if not status["serving"]: raise ValueError("The configured Artemis model is not serving.")
        conversation = request("/api/conversations", {"title": "Artemis live smoke check"}); cid = conversation["id"]
        word = "ref"+secrets.token_hex(5)
        turn(cid, "Remember this exact reference word for my next message: "+word)
        answer, _ = turn(cid, "What was the exact reference word I asked you to remember? Reply with that word.")
        if word not in answer: raise ValueError("The real model failed the two-turn recall check.")
        print("PASS: configured Artemis model completed two turns with saved context.")
        restored = request("/api/conversations/"+cid)
        if len(restored["messages"]) < 4: raise ValueError("Server history was not restored.")
        exported = request("/api/conversations/"+cid+"/export")
        if not exported["model_calls"] or not exported["chunks"]: raise ValueError("The exported generation record is incomplete.")
        print("PASS: server history and generation records are saved.")
        if args.with_python:
            a, b = secrets.randbelow(800)+100, secrets.randbelow(800)+100; expected = a*a+b*b
            answer, events = turn(cid, f"Use run_python to execute print({a}**2+{b}**2). Report stdout exactly.")
            if not any(e.get("name") == "run_python" and e.get("ok") and str(e.get("output", "")).strip() == str(expected) for e in events if e["type"] == "tool_result") or str(expected) not in answer:
                raise ValueError("The real model/tool path did not produce the expected Python result.")
            print("PASS: real model called Python, received the expected result, and answered.")
        print("Smoke checks are narrow; they do not certify overall model quality or global capacity.")
        return 0
    except (ValueError, urllib.error.URLError, TimeoutError, OSError, KeyError) as error:
        print("FAIL:", type(error).__name__, str(error))
        return 1


if __name__ == "__main__": raise SystemExit(main())
