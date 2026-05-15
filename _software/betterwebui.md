---
title: "BetterWebUI"
excerpt: "A friendlier front-end for OpenWebUI built for higher-ed faculty who want the power of agentic AI — running commands, reading files, generating images and audio, and calling MCP servers — without having to be a developer."
collection: software
comments: true
tags:
  - ai
  - agentic
  - technical
  - software
---

`BetterWebUI` is a local Python/FastAPI server with a pure-HTML/CSS/JS front end that connects to an existing [OpenWebUI](https://github.com/open-webui/open-webui) instance and adds a layer of features aimed at higher-education faculty: workspaces, skills, MCP server management, CLI shortcuts, and full KaTeX math rendering.  Every shell command the assistant proposes requires a one-click approval before it executes, and files are exchanged through a local file picker rather than uploaded to any external service.

> **Note:** BetterWebUI is experimental software and is not intended for, nor evaluated or deemed suitable for, any particular production use or critical workload.  No warranty is provided, express or implied.  Run it only in a sandbox environment.  Review every proposed command before approving it.

The package is hosted on GitHub at:

[BetterWebUI](https://github.com/BillJr99/BetterWebUI)

## Key Features

**Workspaces** bundle a system prompt, a chosen subset of skills, MCP servers, CLI shortcuts, and persistent files into a saved configuration.  Switching from a "Grading" workspace to a "Research" workspace takes one click and reloads the entire context.

**Skills** are markdown files that tell the assistant how to handle specific task types.  The assistant sees a list of available skills and their descriptions; when a request matches, it calls `load_skill` to load the full instructions on demand.

**MCP servers** are managed from a curated registry (Filesystem, GitHub, Fetch, Brave Search, Memory, Git, Sequential Thinking, Time) or added as custom entries.  Servers that fail to start surface their error in the UI row rather than crashing the application.

**CLI shortcuts** are pre-registered command templates (git, gh, pandoc, ffmpeg, yt-dlp, sqlite3, ripgrep, curl, or any custom entry) that the assistant can invoke through `cli_call`.  Every invocation passes through the same approval dialog as a raw shell command.

**Math and markdown** rendering supports prose, tables, code blocks, links, and LaTeX via KaTeX (`$inline$`, `$$display$$`, `\(inline\)`, `\[display\]`).

**Multimodal in and out**: images and files can be attached to messages; generated images and audio are streamed directly to the browser and downloaded automatically — nothing is stored on the server.

## Service Integrations

BetterWebUI integrates with three sibling services via REST APIs, exposed at `/api/services/*` and callable by the LLM through tool use or slash commands.

| Service | Default port | Purpose |
|---|---|---|
| [CognitiveLoopKernel (CLK)](https://github.com/BillJr99/CognitiveLoopKernel) | 8001 | Deep research loops and multi-step agentic workflows |
| AutoGUI | 8002 | Desktop GUI automation via ReAct |
| [OSScreenObserver (OSSO)](https://github.com/BillJr99/OSScreenObserver) | 5001 | Screen reading and accessibility inspection |

Each service can be enabled or disabled independently from **Settings → Services**.  Disabled services return HTTP 503; unreachable-but-enabled services degrade gracefully with a descriptive error rather than crashing.  Side-effect tool calls (`clk_research`, `autogui_task`, `screen_action`) require explicit approval before execution.

## Quick Start

```bash
# Docker (recommended)
docker compose up
# then open http://localhost:8765

# Python (macOS/Linux)
./start.sh

# Python (Windows)
start.bat
```

On first run, open **Settings**, paste your OpenWebUI URL and API key, click **Save & test**, and pick a default model.

## Architecture

```
betterwebui/
├── app.py              # FastAPI backend
├── static/             # HTML/CSS/JS frontend (no build step)
├── skills/             # skill markdown files
├── services/           # CLK, AutoGUI, OSSO integration clients
└── data/               # config, conversations, workspaces, uploads
```

The frontend communicates with the backend exclusively over localhost REST calls.  The backend proxies model requests to OpenWebUI, manages MCP server subprocesses, and enforces the approval flow for shell and service tool calls.  There is no telemetry and no external state storage.

## Known Limitations

Shell commands execute on the host machine; the approval dialog is a usability safeguard, not a security boundary.  Integrated services (AutoGUI, OSSO) can take real actions on the desktop.  This software should be run only in a controlled, sandboxed environment and is not suitable for multi-user or production deployment in its current form.
