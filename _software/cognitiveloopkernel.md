---
title: "Cognitive Loop Kernel (CLK)"
excerpt: "A local-first multi-agent development harness that iterates a natural-language idea into a working software system through repeated agentic engineering cycles with dynamic team casting, real file actions, and automatic git commits."
collection: software
comments: true
tags:
  - ai
  - agentic
  - technical
  - software
---

The Cognitive Loop Kernel (CLK) is a local-first multi-agent development harness.  Given a natural-language idea, CLK assembles a dynamically cast team of AI agents, decomposes the objective into a YAML workflow, and iterates toward a working implementation through repeated engineering cycles.  Agents emit machine-parsed `ACTION:` blocks that the harness applies as real file writes, edits, deletions, and shell commands; every successful change is committed automatically to a git repository under the project directory.  All harness state is sandboxed under `.clk/` in the kickoff directory, and the project tree itself is a normal working directory that agents populate directly.

The harness ships with three baseline agents that cannot be removed: a `chief` that decomposes objectives and casts the team by authoring per-project workflow YAML and agent prompts; a `qa` validator; and a `ralph` agent that drives both a refinement loop (iteratively selecting and implementing one measurable improvement per cycle, committing or reverting on validation) and a Karpathy-style autoresearch loop (designing and running small experiments against open questions in the project state).  All other agents, including `engineer` and any domain specialists (e.g., `data_steward`, `ux_writer`, `security_auditor`), are invented dynamically by the chief on a per-project basis.  Casting decisions are recorded in JSONL format to `.clk/state/casting.log`, and the chief is dispatched in recovery mode when a stage's dependencies fail, with the failure reasons provided as context.

CLK supports multiple LLM providers: Claude Code, OpenAI Codex, Google Gemini, any OpenAI-compatible HTTP server (including local Ollama and Open WebUI), and the [pi](https://pi.dev) terminal harness.  A dummy `shell` provider that echoes prompts and writes stub files is always available for testing and dry-run validation without API keys.  Provider selection and model assignment can be configured globally or per-agent.

A terminal UI (TUI) dashboard provides live agent cards showing idle, working, done, and failed states; a scrolling status log; running token and file totals; and a command input field for submitting follow-up instructions or running TUI commands such as `/cast`, `/loop ralph N`, `/loop autoresearch N`, `/provider`, and `/stop`.  A non-interactive pipeline mode is also available for CI and scripted use via `CLK_NO_TUI=true`.

A [pi extension](https://github.com/BillJr99/CognitiveLoopKernel/blob/master/pi-extension/README.md) brings the full CLK orchestration model into the pi terminal harness behind a single `/clk` command, requiring no external Python harness at runtime.

This software is distributed under the [MIT License](https://opensource.org/licenses/MIT).

> **Note:** CLK is a research prototype and is not intended for, nor evaluated or deemed suitable for, any particular production use or critical workload.  No warranty is provided, express or implied.

The package is hosted on GitHub at:

[Cognitive Loop Kernel](https://github.com/BillJr99/CognitiveLoopKernel)

## Quick Start

The `kickoff.sh` script copies the harness into a fresh timestamped workspace directory, gives it its own git repository, and launches the TUI:

```bash
# First time: run the setup wizard
./kickoff.sh --setup

# Start a new project
./kickoff.sh "A local-first journaling app that summarizes my week"
```

CLI overrides are also available:

```bash
./kickoff.sh --provider claude --max-iterations 10 "My idea"
```

## Supported Providers

| Provider | Notes |
|---|---|
| `shell` | Always available; dummy provider for testing and dry runs |
| `claude` | Runs `claude --print` non-interactively; supports CLI auth or API key |
| `codex` | Runs `codex exec` |
| `gemini` | Runs Google Gemini CLI |
| `pi` | pi.dev terminal harness; supports OpenRouter, Anthropic, and other backends |
| `ollama` | Local LLM via HTTP; configure endpoint in `providers.json` |
| `openwebui` | Any OpenAI-compatible server |

## Harness State Layout

```
.clk/
  config/
    clk.config.json        # project-wide settings
    providers.json         # provider registry
    agents.json            # agent-to-prompt mapping
    workflows/*.yaml       # per-project workflow YAML (chief-authored)
  prompts/                 # per-agent system prompts
  state/
    idea.json              # captured idea
    prd.json               # product manager output
    decisions.md           # decisions log
    casting.log            # JSONL roster decisions
    done.md                # written when completion criteria met
  blackboard/              # cross-agent shared scratchpad
  runs/                    # per-dispatch prompt and response logs
  backups/                 # pre-write copies of mutated files
  logs/
    session.log            # TUI status pane mirror
```

## Action Protocol

Agents drive real changes by emitting `ACTION:` blocks parsed and applied by the harness.  Supported action types include `write`, `edit`, `append`, `delete`, `run`, and `done`.  File paths must resolve inside the project root; a cap from configuration limits the number of files mutated per batch to prevent runaway behavior.  All file mutations are preceded by a backup, and every action batch that succeeds produces an immediate structured git commit.

## Safety

Failed work is never silently discarded.  The Ralph refinement loop reverts via `git reset --hard` to the pre-iteration HEAD when validation fails.  Failed agent outputs remain in `.clk/runs/<run_id>/`.  Operations touching more than five files produce a warning; operations above the configured cap are rejected.  All exceptions are logged with a `[location] message` prefix and a full traceback.
