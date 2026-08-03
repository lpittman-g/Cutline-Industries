# Agent handoff — Cursor AI layer (Workstream B)

**Workstream B** — see [WORKSTREAMS.md](WORKSTREAMS.md).

**For a dedicated Cursor Cloud Agent** focused on the Cursor AI layer.  
Do **not** expand into Mission Control product features, media autopilot, bounty, or Stripe clip flows unless the user asks. That is **Workstream A** (Cutline Industries product platform).

**How this got mixed:** In an earlier Cursor chat, everything from the **mcp-server-excel Agent Task** line downward was Workstream B. Keep it in this handoff / a separate agent.

**Repo:** https://github.com/lpittman-g/Cutline-Industries  
**Printer:** HP OfficeJet Pro 9120 · `192.168.1.157` · host `HPIAD66D5`  
**Operator:** Lamont · prefers **Cursor only** (skip Copilot for day-to-day)

---

## Scope (own this)

| Area | Status | Key paths |
|------|--------|-----------|
| Cursor primary for general repo | Merged | `.cursor/rules/cutline-primary.mdc`, `docs/CURSOR-PRIMARY.md`, `scripts/setup-cursor.*` |
| Voice print (chat **`print`**) | Merged | `tools/voice-print/`, MCP, `.cursor/rules/voice-print.mdc` |
| Phone Ops bar (bottom Print button) | Merged | `tools/voice-print/public/mobile.html` |
| Copilot vs Cursor map | Merged | `docs/COPILOT-VS-CURSOR.md` |
| AI Application Card blueprint | Merged | `docs/AI-APPLICATION-CARD-BLUEPRINT.md`, `docs/ai-application-card-blueprint.html` |
| Architecture flow | Merged | See below |

### Canonical architecture

```
Surfaces (Cursor desktop · Cloud · Phone Ops)
    → Client (chat · rules · MCP)
    → Agent loop (context · think → act)
    → Tools (edit · shell · phone-approval · voice-print)
    → Runtime (PC LAN · Cloud VM · Cursor)
```

Runtime host is **Cursor**. GitHub is only for repos/PRs/Actions.

---

## Out of scope (do not pick up unless asked)

- Thermal Mission Control heat → clip → bounty → Stripe
- Media autopilot / AI video pipeline product work
- Outreach content strategy and AdSense campaigns
- SynthLang product-feature work beyond CI health

---

## Constraints the previous agent learned

1. **Cursor mobile/cloud cannot reach the LAN printer.** Print only via:
   - Local Cursor on PC + voice-print MCP → chat **`print`**
   - PC `npm start` in `tools/voice-print` → phone `http://<PC-IP>:8791/mobile.html`
2. **Cannot add buttons inside Cursor mobile chat UI** (Composer bar). Workaround = home-screen Cutline Ops PWA (`/mobile.html`).
3. Prefer **Cursor** over Copilot for day-to-day; Copilot configs are optional mirrors.
4. Cloud agents cannot reach `192.168.1.157`.
5. Do **not** expand into unrelated Workstream A product work unless asked.

---

## Quick start for the new agent

```bash
# On the operator PC (LAN)
cd tools/voice-print && npm start
# Phone: http://<PC-IP>:8791/mobile.html  → Add to Home Screen
```

Repo docs: `docs/CURSOR-PRIMARY.md`, `docs/COPILOT-VS-CURSOR.md`, `docs/AI-APPLICATION-CARD-BLUEPRINT.md`.
