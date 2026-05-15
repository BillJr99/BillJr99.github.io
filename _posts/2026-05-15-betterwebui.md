---
title: 'BetterWebUI: A Faculty-Friendly Agentic Front End for OpenWebUI'
date: 2026-05-15
permalink: /posts/2026/05/betterwebui/
tags:
  - ai
  - agentic
  - technical
  - software
---

Most large language model interfaces are designed for developers or for a general consumer audience.
Faculty who want to use an AI assistant to help with grading, research, or course preparation either accept the
limitations of a consumer chat interface or invest significant time learning to run and configure a developer-grade
setup. [BetterWebUI](https://github.com/BillJr99/BetterWebUI) is an attempt to close that gap.
It is a local Python/FastAPI server with a pure-HTML front end that connects to an existing
[OpenWebUI](https://github.com/open-webui/open-webui) instance and layers on the features that make an agentic
assistant genuinely useful in a higher-education context: workspaces, skills, MCP server management, CLI shortcuts,
math rendering, and a suite of integrations with sibling agentic services.

> **Experimental software — use at your own risk.**
> BetterWebUI is a research prototype. It is not intended for, and has not been
> evaluated or deemed suitable for, any particular purpose, production
> use, or critical workload. No warranty is provided, express or implied.
> Shell commands approved in the chat interface execute directly on the host machine;
> integrated services (CLK, AutoGUI, OSScreenObserver) may take real actions on your desktop.
> Run this software only in an isolated, sandboxed environment and review
> every command before approving it. By using this software you accept all
> associated risks.
>
> Contributions, bug reports, and ideas are very welcome — feel free to
> open an issue or pull request!

## The Problem

OpenWebUI is an excellent self-hosted model interface with a wide feature set, but its feature set is also its
complexity. A faculty member who wants to run a grading assistant, attach a course rubric to every conversation in
that context, switch to a research assistant context, and then have the assistant read a file from the local
filesystem is navigating four separate configuration surfaces. BetterWebUI reduces that to a single workspace
dropdown and a file picker, while keeping all data local.

A second problem is tooling reach. An AI assistant that can only generate text is useful; one that can run a
pandoc conversion, call a GitHub API, fetch a web page, read the current screen state, or orchestrate a multi-step
research workflow is qualitatively more useful for the kinds of tasks faculty actually do. BetterWebUI provides
a unified approval-gated interface for all of these capabilities.

## Architecture

BetterWebUI is organized around three layers: a FastAPI backend that manages state and proxies model requests;
a zero-build-step HTML/CSS/JS frontend that communicates with the backend over localhost REST calls; and an
integration layer that wraps three sibling agentic services behind a common `/api/services/*` routing namespace.

```
betterwebui/
├── app.py              # FastAPI backend — model proxy, MCP manager, approval flow
├── static/             # HTML/CSS/JS frontend
├── skills/             # skill markdown files (loaded on demand)
├── services/           # integration clients (CLK, AutoGUI, OSSO)
└── data/               # config.json, conversations, workspaces, uploads
```

There is no external state. All persistent data — settings, conversations, workspaces, skill files, and
uploaded attachments — lives in the `data/` directory on the local machine. The only network traffic is
outbound to the configured OpenWebUI instance (which may itself be local) and, optionally, to the three
sibling services.

### Frontend

The frontend is intentionally dependency-free from a build perspective. There is no npm build step, no webpack,
and no framework. Every feature is plain HTML, CSS, and vanilla JavaScript, loaded directly from the `static/`
directory. KaTeX is loaded from a CDN for math rendering. This makes the frontend trivially auditable and
deployable: `docker compose up` or `./start.sh` is sufficient, and the UI is available immediately at
`http://localhost:8765`.

### Backend

The FastAPI backend handles five primary concerns:

- **Model proxying**: BetterWebUI auto-detects which API path OpenWebUI exposes (`/api`, `/v1`, `/openai/v1`,
  etc.) and forwards requests transparently, enriching them with the active workspace's system prompt, skill
  content, and any persistent files attached to the workspace.
- **MCP server management**: MCP servers are spawned as subprocesses (via `npx` or `uvx`) and managed over
  stdio. The backend tracks process health and surfaces startup errors in the UI.
- **Skill loading**: When the assistant calls `load_skill`, the backend reads the requested skill markdown file
  and injects its content into the conversation context.
- **CLI tool dispatch**: The `cli_call` tool constructs a command from a registered template and the
  assistant's arguments, presents it for user approval, and executes it on approval.
- **Service integration**: The `/api/services/*` namespace routes requests to CLK, AutoGUI, or OSSO,
  enforces the per-service enable/disable state, and handles graceful degradation when a service is
  unreachable.

### Approval Flow

Every action that touches the host machine is gated. Shell commands (from `cli_call` or a raw `run` block)
display a dialog showing the exact command and the assistant's stated reason before execution. File saves
show a filename preview. File reads open a native file picker so the assistant only ever sees what the user
explicitly selects. Side-effect calls to CLK (`clk_research`), AutoGUI (`autogui_task`), and OSSO
(`screen_action`) are similarly gated. Read-only service calls (`screen_windows`, `screen_description`,
`screen_screenshot`) run without an approval prompt.

Shell execution can be disabled entirely from Settings, in which case `cli_call` and raw shell blocks
return a descriptive error rather than presenting an approval dialog.

## Workspaces

A workspace is a saved bundle of context: a system prompt, a chosen subset of skills, a chosen subset of MCP
servers, a chosen subset of CLI shortcuts, persistent files that are attached to every new chat in that
workspace, and an optional default model. The workspace dropdown at the top of the chat interface switches
between them with a single click, reloading the entire context.

The workspace model reflects how faculty actually work. A "Grading" workspace has the grading-rubric skill
loaded, a PDF of the current rubric attached, and a system prompt that frames the assistant as a grading
helper. A "Research" workspace has the research-citations skill, the Fetch and Brave Search MCP servers
enabled, and a system prompt oriented toward literature review. Switching contexts does not require
re-configuring anything; the workspace carries all of that state.

## Skills

Skills are markdown files in the `skills/` directory, each with a YAML frontmatter header:

```markdown
---
name: Grading Rubric Helper
description: When the user wants to evaluate student work against a rubric
---

When this skill is loaded, apply the attached rubric to the student submission...
```

The assistant sees a list of available skills and their descriptions. When a user request matches a skill's
description, the assistant calls `load_skill` to read the full instructions and follow them. Skills are
loaded on demand rather than injected into every conversation, which keeps the context window efficient.

Three example skills ship with the repository: a rubric helper, a citation helper, and a computer helper.
New skills can be added from the Skills sidebar or by dropping a `.md` file into the `skills/` folder.

## MCP Servers

BetterWebUI manages MCP server subprocesses directly and presents them through a curated registry in the
Tools sidebar:

| Server | Transport | Purpose |
|---|---|---|
| Filesystem | `npx` | Read/write files in a chosen directory |
| GitHub | `npx` | Repos, issues, PRs (requires a PAT) |
| Fetch | `uvx` | Retrieve and parse web pages |
| Brave Search | `npx` | Web search (requires a Brave API key) |
| Memory | `npx` | Persistent knowledge graph |
| Git | `uvx` | Read a local git repo's history |
| Sequential Thinking | `npx` | Stepped reasoning |
| Time | `uvx` | Accurate time and timezone conversion |

Custom entries can be registered with an arbitrary command and argument list. If a server fails to start,
the error message from the subprocess is surfaced in the server's UI row so the prerequisite (typically
a missing `npx` or `uvx`) is immediately visible.

## Service Integrations

BetterWebUI exposes three sibling agentic services through a unified `/api/services/*` routing namespace.
Each service can be enabled or disabled independently from Settings → Services. Disabled services return
HTTP 503 immediately. Enabled but unreachable services return a descriptive HTTP 503 rather than crashing.

### CognitiveLoopKernel (CLK)

[CLK](https://github.com/BillJr99/CognitiveLoopKernel) is a local-first multi-agent development harness that
takes a natural-language idea and iterates it toward a working implementation through dynamic agent casting,
YAML workflow orchestration, and automatic git commits. Through BetterWebUI, the `/research <topic>` slash
command starts a CLK workflow, and the `clk_research` tool allows the assistant to initiate, monitor, and
retrieve artifacts from research loops. Every invocation requires a one-click approval showing the workflow
and command before anything executes.

### AutoGUI

AutoGUI provides desktop GUI automation via a ReAct-style loop. The `/automate <task>` slash command sends a
task description to AutoGUI. The `autogui_task` tool surfaces the task for approval before execution. AutoGUI
runs in dry-run mode by default, which reports what it would do without taking real actions.

### OSScreenObserver (OSSO)

[OSScreenObserver](https://github.com/BillJr99/OSScreenObserver) exposes the operating system's UI
accessibility tree, OCR text, and ASCII spatial sketches through an MCP interface. Through BetterWebUI, the
`/observe` slash command returns a description of the current screen. Read-only tools (`screen_windows`,
`screen_description`, `screen_screenshot`) run without an approval prompt; the `screen_action` tool, which
can click, type, and press keys on real OS controls, requires explicit approval.

## Math and Markdown

The frontend renders the assistant's responses as full markdown — headings, lists, tables, code blocks, and
links — and passes mathematical expressions through KaTeX for display-quality typesetting. Both inline
(`$...$`, `\(...\)`) and display (`$$...$$`, `\[...\]`) delimiters are supported. The assistant is
explicitly told in its system context that these delimiters are available, so it uses them naturally when
the conversation calls for mathematical notation.

## Safety Considerations

BetterWebUI's approval flow is a usability safeguard, not a security boundary. Shell commands execute on
the host machine with the permissions of the user running the server. The approval dialog makes every
proposed command visible and requires an explicit click before execution, but it does not sandbox or
restrict what an approved command can do. Similarly, AutoGUI and OSScreenObserver can take real actions on
the desktop once approved.

This means BetterWebUI should be run in a controlled, sandboxed environment — a dedicated virtual machine
or container with limited access to sensitive files and services is the appropriate deployment context for
any non-trivial use. Multi-user deployment is not supported in the current prototype; the `data/`
directory is a flat, single-user store with no access controls.

Shell execution can be disabled entirely from Settings. When disabled, `cli_call` and any raw shell blocks
return a descriptive error rather than presenting an approval dialog, which reduces the tool surface to
model inference, skill loading, MCP tool calls, and read-only service queries.

## Getting Started

The fastest path is Docker:

```bash
docker compose up
# open http://localhost:8765
```

Or directly with Python:

```bash
# macOS/Linux
./start.sh

# Windows
start.bat
```

On first run, open Settings, paste your OpenWebUI URL and API key, click **Save & test**, and pick a
default model. If you have CLK, AutoGUI, or OSScreenObserver running on their default ports, enable them
from Settings → Services. Everything else — workspaces, skills, MCP servers — can be configured from the
sidebar without a restart.

The source and full documentation are available on [GitHub](https://github.com/BillJr99/BetterWebUI)
under the MIT License.
