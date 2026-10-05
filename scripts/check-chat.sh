#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TASK_PYTHON="${ARTEMIS_TEST_PYTHON:-python}"
"$TASK_PYTHON" -m pytest -q tests/test_chat_application.py tests/test_chat_format.py tests/test_chat_failures.py tests/test_tools.py tests/test_business.py tests/test_orchestrator.py tests/test_memory_stream.py tests/test_engine.py tests/test_deployment_wiring.py
node site/api-client.test.cjs
node site/chat-stream.test.cjs
node --check site/workspace.js
node --check site/main.js
