# Agent handoff — Cursor AI layer (NOT the gaming YouTube channel)

**For a new Cursor Cloud Agent.** Do **not** work on Thermal Mission Control, VOD autopilot, AI Shorts, bounty, Stripe clips, or YouTube growth unless the user asks. That work stays with the Gaming YouTube / Thermal agent.

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
- YouTube Shorts / VOD autopilot / AI video pipeline
- Gaming channel content strategy, outreach, AdSense
- SynthLang / gaming product features

---

## Constraints the previous agent learned

1. **Cursor mobile/cloud cannot reach the LAN printer.** Print only via:
   - Local Cursor on PC + voice-print MCP → chat **`print`**
   - PC `npm start` in `tools/voice-print` → phone `http://<PC-IP>:8791/mobile.html`
2. **Cannot add buttons inside Cursor mobile chat UI** (Composer bar). Workaround = home-screen Cutline Ops PWA (`/mobile.html`).
3. **GitHub Application Card** = responsible-AI transparency doc, not a UI widget. Cutline version is the printable blueprint.
4. **Copilot is optional.** Prefer Cursor; keep `.github/` mirrors in sync only when changing shared behavior.
5. Branches: `cursor/<descriptive-name>-6543`

---

## Related PRs (already merged)

| PR | Topic |
|----|--------|
| #24–#27 | Voice print tool, chat print, Copilot MCP, phone LAN UI |
| #31 | Unify Cursor + Copilot `@voice-print` |
| #32–#33 | Cursor primary for general repo |
| #34 | COPILOT-VS-CURSOR.md + mobile Ops bar |
| #35–#36 | AI Application Card blueprint |
| #37–#38 | Runtime = Cursor in architecture flow |

---

## Suggested next work (pick up here)

1. Harden voice-print HTML→PDF on Windows (Edge path, timeouts).
2. ~~Improve Cutline Ops `/mobile.html`~~ — done: ◀/▶ cycle, ⋯ sheet (refresh · AI Card · list · Mission Control).
3. Keep Application Card + COPILOT-VS-CURSOR in sync when MCP/rules change.
4. Optional: MCP App / interactive card **only if** host supports it — Cursor mobile still cannot inject toolbar buttons.
5. Do **not** expand into Thermal/YouTube unless user redirects.

---

## Quick verify

```bash
git pull origin main
cd tools/voice-print && npm install && npm run list
# Expect ai-application-card-blueprint in catalog
```

Docs to read first: `CURSOR-PRIMARY.md` → `COPILOT-VS-CURSOR.md` → `AI-APPLICATION-CARD-BLUEPRINT.md` → `tools/voice-print/README.md`
