---
title: "mcpproxy"
excerpt: "A config-driven MCP host that exposes a single HTTP MCP endpoint backed by YAML-defined tool providers, with a built-in web UI for editing providers, managing secrets, and streaming live command output."
collection: software
comments: true
tags:
  - ai
  - mcp
  - agentic
  - technical
  - software
---

> **Note:** `mcpproxy` is experimental software provided as-is, with no guarantees of security, stability, or fitness for any particular purpose.  It has not undergone a security audit.  Do not expose it to untrusted networks or use it to handle sensitive data in production.

`mcpproxy` is a Dockerized, config-driven MCP host that presents a single `http://localhost:8888/mcp` endpoint to any MCP-capable AI client.  Every tool provider is a single YAML file: the YAML embeds the Python `async def` handler functions directly, declares the tool names, descriptions, and JSON Schema input schemas, and lists the environment variables the server should inject as secrets at call time.  Alternatively, a provider can delegate entirely to an existing MCP npm package via an `npx:` block, with no Python code required.  `server.py` loads all YAML files at startup, executes each `code` block or spawns the declared `npx` process, and registers every declared tool automatically — adding a new tool requires only a new YAML file, with no changes to the server.

A FastAPI frontend (port 8889) provides a browser-based interface for the full provider lifecycle.  The Tools tab lists all loaded providers in a left panel; clicking a provider opens a form editor for its documentation, code, and per-tool fields, with buttons to add or remove tools, save the file, and restart the MCP server in place.  A **+ New Provider** wizard supports both Python code and npx package types; the wizard's final step lists all required secrets and writes them to `.env` without leaving the browser.  A **🔑 Secrets** panel reads declared `secrets.env` entries from the selected provider, shows which variables are already set, and lets you fill in or update values interactively.  A **🛠 Run Command** panel runs any shell command inside the server environment and streams output live — particularly useful for npx providers that need one-time setup, such as `npx playwright install chrome`.

Secrets declared in a provider's `secrets.env` block are injected from the environment at call time; their values are never part of the MCP tool schema and are never visible to the LLM.  Docker Compose reads `.env` via `env_file`; the file is never baked into the image.  The `tools/` directory is similarly gitignored and must be mounted at runtime.

A pre-built image is published to the GitHub Container Registry on every push to `main`:

```bash
docker pull ghcr.io/billjr99/mcpproxy:latest
docker run -d --rm \
  -p 8888:8888 -p 8889:8889 \
  --env-file .env \
  -v "$(pwd)/tools":/app/tools \
  --name mcpproxy \
  ghcr.io/billjr99/mcpproxy:latest
```

The package is hosted on GitHub at:

[mcpproxy](https://github.com/BillJr99/mcpproxy)

## Quick Start

```bash
git clone https://github.com/BillJr99/mcpproxy
cd mcpproxy
./run_local.sh
```

`run_local.sh` generates `.env.example` from any existing tool YAMLs, prompts for missing secret values, creates a virtualenv, installs dependencies, and starts the server.  The MCP endpoint is at `http://localhost:8888/mcp` and the web UI at `http://localhost:8889`.

## Connecting AI Clients

`mcpproxy` works with any client that speaks the MCP HTTP transport.  A few examples:

| Client | Configuration |
|---|---|
| **Claude Code** | `claude mcp add --transport http mcpproxy http://localhost:8888/mcp` |
| **Claude Desktop** | Add `{"url": "http://localhost:8888/mcp", "transport": "http"}` to `claude_desktop_config.json` |
| **Cursor** | Add a server entry in Settings → Features → MCP |
| **Cline** | MCP Servers tab → Add MCP Server, transport HTTP/SSE |
| **Continue** | Add an entry to `.continue/config.json` |
| **OpenCode** | Add to `opencode.json` under `mcp.servers` |
| **Windsurf** | Settings → Cascade → MCP |
| **Ollama** | Use the included `tests/ollama_agent.py` bridge script |

## Provider YAML Reference

Each YAML file under `tools/` follows this schema:

```yaml
documentation: |           # optional; shown in the web UI
  Describe this provider.

code: |                    # Python source executed once at startup
  async def my_tool(context, arg1, arg2):
      return {"ok": True, "result": arg1}

# -- OR -- (mutually exclusive with code)
npx:
  command: npx @playwright/mcp@latest --headless --isolated

tools:
  - name: my_tool
    function: my_tool      # async function name from code block
    description: "..."
    input_schema:
      type: object
      properties:
        arg1: {type: string}
      required: [arg1]
    secrets:
      env:
        arg2: MY_SERVICE_API_KEY
```

Secrets are injected from the environment; they are never part of the tool schema.

## Test Suite

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest tests/ -v
```

Unit tests cover `server.py` helpers and all `frontend/app.py` API endpoints.  Additional shell scripts (`tests/mcp_interactive.sh`, `tests/test_with_ollama.sh`) and a Python agentic loop (`tests/ollama_agent.py`) support end-to-end validation against a running server.
