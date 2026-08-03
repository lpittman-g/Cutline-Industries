# GitHub Copilot architecture (reference)

Copilot is **optional** for this repo. Use [CURSOR-PRIMARY.md](CURSOR-PRIMARY.md) instead.

## Copilot full structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER SURFACES (apps)                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│ VS Code /    │ JetBrains /  │ Copilot CLI  │ github.com   │ Mobile /    │
│ Visual Studio│ Neovim /     │ (terminal)   │ (tasks,      │ other       │
│              │ Eclipse      │              │ issues, PRs) │ clients     │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
       │              │              │              │              │
       └──────────────┴──────────────┴──────────────┴──────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                    COPILOT CLIENT / SHELL (per surface)                  │
│  Extension UI · chat · agent picker · model picker · tool toggles        │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│              AGENT HARNESS (orchestrator — GitHub/MS, mostly closed)     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Context     │  │ Prompt      │  │ Tool loop   │  │ Safety /    │   │
│  │ assembly    │  │ builder     │  │ think→act   │  │ permissions │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
┌──────▼──────┐            ┌────────▼────────┐         ┌────────▼────────┐
│ LLM layer   │            │ Built-in tools  │         │ MCP + extensions│
│ (multi-model│            │ read/edit/run/  │         │ your servers,   │
│  routing)   │            │ search/github   │         │ agents, skills  │
└──────┬──────┘            └────────┬────────┘         └────────┬────────┘
       │                            │                            │
       └────────────────────────────┴────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                         EXECUTION ENVIRONMENT                          │
│  Local: your PC (files, terminal, LAN)  │  Cloud: GitHub VM (repo only)│
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                    GITHUB PLATFORM (when needed)                       │
│  Repos · branches · PRs · Actions · secrets · Agent Tasks API          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Cursor equivalent (Cutline default)

| Copilot layer | Cursor in this repo |
|---------------|---------------------|
| VS Code / CLI / github.com tasks | **Cursor desktop + Cloud Agent** |
| Copilot instructions | **`.cursor/rules/cutline-primary.mdc`** |
| Custom agent `@voice-print` | **`voice-print` rule + MCP** |
| `.vscode/mcp.json` | **`.cursor/mcp.json.example`** |
| Cloud coding agent | **Cursor Cloud Agent** on same GitHub repo |
| Agent Tasks API | Cursor dashboard / mobile agent runs |

## When Copilot still helps

- You prefer VS Code over Cursor UI
- GitHub.com **Copilot coding agent tasks** from the browser
- Team members without Cursor seats

For Cutline day-to-day: **open Cursor, follow [CURSOR-PRIMARY.md](CURSOR-PRIMARY.md).**
