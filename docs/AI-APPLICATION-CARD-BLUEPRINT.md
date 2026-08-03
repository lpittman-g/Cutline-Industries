# Cutline Industries — AI Application Card Blueprint

**Brand:** Cutline Industries · Thermal  
**Primary host:** Cursor (not GitHub Copilot)  
**Inspired by:** [GitHub Copilot Chat Application Card](https://docs.github.com/en/copilot/responsible-use/chat#what-is-an-application-card) — responsible AI transparency, not a chat UI widget.

Printable HTML: [`ai-application-card-blueprint.html`](ai-application-card-blueprint.html)

---

## 1. Overview

| Field | Value |
|-------|--------|
| **Application** | Cutline AI coding + ops layer |
| **Purpose** | Build Thermal (heat → clip → pay → retain), run agent tools, print blueprints |
| **Primary surface** | Cursor desktop + Cursor Cloud Agent |
| **Optional surface** | VS Code / GitHub Copilot (mirrored configs) |
| **Operator** | Human — you approve PRs, secrets, Stripe, and print |

An **Application Card** (per GitHub’s responsible-use model) documents what the AI application is for, what it can do, and where humans stay in control.

---

## 2. Cursor vs Copilot (use Cursor)

| Copilot | Cursor (use this) |
| --- | --- |
| Copilot Chat | **Cursor chat** |
| `copilot-instructions.md` | **`cutline-primary.mdc`** |
| Cloud agent tasks | **Cursor Cloud Agent** |
| VS Code MCP | **`~/.cursor/mcp.json`** |
| `@voice-print` agent | Chat **`print`** + voice-print MCP |

Full table: [COPILOT-VS-CURSOR.md](COPILOT-VS-CURSOR.md)

---

## 3. Architecture

```
Surfaces (Cursor desktop · Cloud · Phone Ops)
    → Client (chat · rules · MCP)
    → Agent loop (context · think → act)
    → Tools (edit · shell · phone-approval · voice-print)
    → Runtime (PC LAN · Cloud VM · GitHub)
```

| Runtime | Can reach HP printer? |
|---------|------------------------|
| Cursor on PC (same Wi‑Fi) | Yes |
| Cursor Cloud / mobile chat | No → use `/mobile.html` Ops bar |
| GitHub Copilot cloud task | No |

---

## 4. Capabilities & limitations

### Can do
- Edit Thermal UI (`src/`), API (`server/`), docs
- Open PRs via Cursor Cloud Agent
- MCP: `phone-approval-lite`, `voice-print` (local)
- Run `npm run start`, migrations, pipelines

### Cannot do alone
- Reach home LAN printer from cloud
- Deploy or spend money without you
- Customize Cursor mobile chat toolbar buttons
- Bypass PR / secret review

### Human oversight
- Merge gates, Stripe keys, YouTube OAuth, print server on PC

---

## 5. Repo wiring

| Layer | Path |
|-------|------|
| Primary rules | `.cursor/rules/cutline-primary.mdc` |
| Print rule | `.cursor/rules/voice-print.mdc` |
| MCP example | `.cursor/mcp.json.example` |
| Copilot mirror | `.github/copilot-instructions.md`, `.github/agents/voice-print.agent.md` |
| Setup | `scripts/setup-cursor.ps1` / `setup-cursor.sh` |

---

## 6. Responsible use principles

| Principle | Cutline practice |
|-----------|------------------|
| **Transparency** | This blueprint + CURSOR-PRIMARY docs |
| **Reliability & safety** | Branches `cursor/*-6543`, SynthLang CI, human merge |
| **Privacy & security** | Secrets in `.env` only; printer on LAN |
| **Accountability** | Operator ships; AI proposes |

---

## 7. Daily path

1. Open repo in **Cursor** (after `setup-cursor`)
2. Chat for code / Thermal / tools
3. Print: PC `tools/voice-print` → chat **`print`** or phone **`/mobile.html`**

---

## Related

- [CURSOR-PRIMARY.md](CURSOR-PRIMARY.md)
- [COPILOT-VS-CURSOR.md](COPILOT-VS-CURSOR.md)
- [COPILOT-ARCHITECTURE.md](COPILOT-ARCHITECTURE.md)
- [VOICE-PRINT-PHONE.md](VOICE-PRINT-PHONE.md)
- GitHub reference: [What is an Application Card?](https://docs.github.com/en/copilot/responsible-use/chat#what-is-an-application-card)
