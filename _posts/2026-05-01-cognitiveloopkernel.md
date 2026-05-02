---
title: 'Cognitive Loop Kernel: A Local-First Multi-Agent Development Harness'
date: 2026-05-01
permalink: /posts/2026/05/cognitivelloopkernel/
tags:
  - technical
  - ai
  - agentic
  - software
---

The emergence of capable code-generation models has prompted a wave of experiments in autonomous software development, where LLM agents plan, implement, test, and revise code with minimal human intervention. Most of these systems, however, rely on cloud orchestration services, opaque runtimes, or monolithic agent designs that make it difficult to inspect, customize, or extend the underlying behavior. The [Cognitive Loop Kernel (CLK)](https://github.com/BillJr99/CognitiveLoopKernel) is a local-first, multi-agent development harness that attempts to address these constraints directly. You give it an idea, and a dynamically assembled team of agents iterates that idea into a working system through repeated agentic development cycles, all under your local filesystem.

This article provides a detailed walkthrough of CLK's architecture, its principal subsystems, and the design decisions that distinguish it from similar tools.

> **Experimental software — use at your own risk.**
> CLK is a research prototype. It is not intended for, and has not been
> evaluated or deemed suitable for, any particular purpose, production
> use, or critical workload. No warranty is provided, express or implied.
> By using this software you accept all associated risks.
>
> Contributions, bug reports, and ideas are very welcome — feel free to
> open an issue or pull request!

## Why a Local-First Harness?

The core motivation for CLK is reproducibility and ownership. Everything the harness produces, including agent prompts, provider configurations, per-run logs, intermediate file states, and git history, lives under a single `.clk/` directory inside a project folder on your local disk. There is no external orchestration service, no account required, and no state stored elsewhere. If you want to inspect what a particular agent said in iteration four of last Tuesday's engineering loop, you look at `.clk/runs/`. If you want to understand why the chief cast a `security_auditor` role, you read `.clk/state/casting.log`. The harness treats transparency as a first-class property of the system.

A second motivation is provider agnosticism. CLK supports Claude Code, OpenAI Codex, Google Gemini, any OpenAI-compatible HTTP server (via OpenWebUI), local Ollama models, Pi, and a built-in shell dummy provider for testing and CI. Switching providers requires a single configuration change, and different agents within the same workflow can be bound to different providers, so you can route heavy reasoning tasks to a cloud model while keeping low-stakes validation steps on a local Ollama instance.

## High-Level Architecture

CLK is organized around three principal concerns: state management, agent orchestration, and provider abstraction. The package layout reflects this separation.

```
clk_harness/
  cli.py                 # argparse entrypoint and command dispatch
  config.py              # paths, default configs, JSON load/save helpers
  git_ops.py             # init, commit, revert, and status wrappers
  providers/             # claude, codex, gemini, ollama, openwebui, pi, shell
  orchestration/         # agent runner, workflow runner, ralph/autoresearch loops
  templates/             # bundled prompts and default workflow YAML
  utils/                 # structured logging and activity tracking
```

The harness state, written by `clk init` and extended by every subsequent command, is isolated under `.clk/` in the project root:

```
.clk/
  config/
    clk.config.json      # project-wide configuration
    providers.json       # provider registry and active selection
    agents.json          # agent-to-prompt-and-provider mapping
    workflows/*.yaml     # Archon-style workflow definitions
  prompts/               # per-agent system prompt templates
  state/
    idea.json            # the captured project idea
    system_brief.md      # initial brief
    prd.json             # product manager output
    progress.md          # human-readable development timeline
    decisions.md         # log of architectural decisions
    experiments.jsonl    # per-iteration outcome records
    agent_memory.jsonl   # all agent invocations with token usage
    casting.log          # JSONL of every roster change
    done.md              # written when completion criteria are met
  blackboard/            # cross-agent shared scratchpad (POST blocks)
  logs/                  # session and per-command logs
  runs/                  # per-invocation prompt and response capture
  backups/               # safety copies of files before mutation
```

This layout means that deleting `.clk/` resets the harness entirely without touching anything the agents actually built. The project source, tests, documentation, and configuration live in the project root proper and are managed by an ordinary git repository.

## Dynamic Agent Casting

The most distinctive architectural decision in CLK is dynamic team assembly. Rather than shipping a fixed roster of roles, the harness ships three baseline agents that cannot be removed, and then lets the `chief` agent invent and register project-specific specialists on the fly.

The three baseline agents are `chief`, which decomposes objectives, casts the team, and authors workflow YAML; `ralph`, which drives both the iterative refinement loop and Karpathy-style autoresearch cycles; and `qa`, which validates stage outputs. Every other agent, including `engineer`, is a dynamic role that the chief creates by emitting a structured `PROPOSE_ROLE` block in its response text:

```
PROPOSE_ROLE: data_steward
ROLE: ensure data integrity and schema versioning
PROVIDER: claude
PROMPT:
You are the **Data Steward** agent.
Objective: $objective
State: $state_summary
...
END_ROLE
```

The harness parses this block, writes the generated prompt to `.clk/prompts/data_steward.md`, registers the role in `.clk/config/agents.json`, and makes it available to subsequent stages in the same workflow cycle, all without pausing execution. Every roster decision is appended as a JSONL entry to `.clk/state/casting.log`, giving you a complete provenance record of how the team evolved over the project's lifetime.

The chief can also propose custom workflows:

```
PROPOSE_WORKFLOW: engineering
YAML:
name: engineering
stages:
  - id: decompose
    agent: chief
    objective: Decompose the current top-level objective.
  - id: implement
    agent: data_steward
    depends_on: [decompose]
    validation: "pytest -q"
    commit: true
END_WORKFLOW
```

The harness validates the YAML (both via PyYAML when available and a built-in mini-parser for environments where `ensurepip` is unavailable), writes the file to `.clk/config/workflows/`, and routes the next `clk run` invocation through the new stage graph. This architecture means the project workflow is not hardcoded into the harness; it is a first-class artifact that the chief authors and evolves as it learns more about the project's requirements.

The name `engineer` is reserved and protected. The harness rejects attempts to create aliases such as `engineering`, `coder`, or `developer`, and feeds the rejection back into the chief's context as casting feedback so it learns to use the canonical name directly. A cap from `clk.config.json::casting.max_dynamic_roles` (default 12) prevents unbounded role proliferation.

## The Action Protocol

Agents drive real changes by emitting structured `ACTION:` blocks. A response that merely describes what should happen but emits no ACTION blocks has no side effects, which is a deliberate design choice: the harness makes it impossible for an agent to accidentally mutate the project simply by describing a plan.

The supported action types are:

- `ACTION: write` creates or overwrites a file at the specified path.
- `ACTION: edit` applies a targeted textual replacement within an existing file, analogous to a very simple diff application.
- `ACTION: append` adds content to the end of an existing file.
- `ACTION: delete` removes a file.
- `ACTION: run` executes a shell command from the project root with output captured to the log.
- `ACTION: done` writes `.clk/state/done.md` and signals all loops to terminate.

All paths are validated against the project root before execution. Any path that resolves into `.clk/` is rejected outright (with the single exception of `.clk/blackboard/`, which agents may write to via POST blocks). Attempted path traversal outside the project root is similarly rejected. Before any file is mutated, the original is backed up to `.clk/backups/<run_id>/`, so every overwrite is recoverable. A per-response cap of 25 file actions prevents runaway agents from restructuring the entire project in a single cycle.

Following each successful batch of action applications, the harness generates a structured git commit with the agent name, objective, files changed, commands run, and token totals embedded in the commit body. The git log thus becomes a faithful narrative of the project's development, authored by the agents themselves.

## Blackboard: Cross-Agent Communication

Agents in a multi-stage workflow often need to share findings without routing everything through the chief as a relay. CLK provides a structured shared scratchpad called the blackboard, which lives at `.clk/blackboard/` as a collection of JSON files.

Rather than writing to the blackboard directly via ACTION blocks (which the harness would reject as `.clk/` access), agents emit POST blocks:

```
POST: finding
TITLE: Database schema analysis complete
PRODUCES: schema_contract
BODY:
Three tables identified: users, sessions, events.
The sessions table lacks a foreign key constraint.
Recommend adding: ALTER TABLE sessions ADD FOREIGN KEY ...
END_POST
```

The harness parses this block, adds metadata (timestamp, author, stage ID, workflow name), and writes the post as a JSON file under `.clk/blackboard/`. When the next stage runs, the workflow runner injects a filtered digest of relevant posts into each agent's prompt via the `$blackboard_digest` placeholder. Stage definitions can declare `inputs` to specify which posts they want to consume and `outputs` to specify which contract keys they are expected to produce, enabling the workflow runner to verify that inter-agent contracts are satisfied before committing a stage.

Posts are immutable. To revise a finding, an agent writes a new post with the original post ID listed in the `CONSUMES` field, creating an auditable revision chain rather than silent overwriting.

## Workflow Execution and Dependency Resolution

Workflows are YAML files describing a directed acyclic graph of stages, each bound to an agent and an objective:

```yaml
name: engineering
description: Single development cycle.
stages:
  - id: decompose
    agent: chief
    objective: Decompose the current top-level objective.
  - id: implement
    agent: engineer
    objective: Implement the smallest vertical slice.
    depends_on: [decompose]
    validation: "pytest -q"
    commit: true
  - id: validate
    agent: qa
    objective: Audit implementation and confirm test passage.
    depends_on: [implement]
```

The workflow runner (`orchestration/workflow.py`) topologically sorts stages by their `depends_on` declarations and executes stages that share no dependencies in parallel using a `ThreadPoolExecutor`. Each stage may declare a `validation` shell command; the command must exit 0 before the harness will commit the stage's changes. Failed validations leave the working tree untouched. The parallel execution design means that a large workflow with independent research and implementation tracks can run those tracks concurrently rather than serially.

The default `engineering.yaml` workflow ends with a `supervise` stage, where the chief evaluates whether the user's original prompt has been fully addressed. The chief either emits an `ACTION: done` block (writing `done.md` and terminating the loop) or emits a `PROPOSE_WORKFLOW` block describing the next iteration's stages, upon which the runner picks them up and executes another cycle. This supervisor loop is capped at `clk.config.json::supervise.max_cycles` (default 5) to prevent runaway iteration.

## Self-Healing on Unmet Dependencies

When a workflow stage's declared dependencies fail, the harness does not silently skip the stage or crash. Instead, it dispatches the `chief` agent in recovery mode, providing the exact failure reasons (agent error text, validation command output, QA report) and asking the chief to either re-cast the workflow, emit ACTION blocks that fix the upstream failure directly, or propose a specialist agent that can resolve the issue. This recovery dispatch is capped at three passes per stage (configurable via `clk.config.json::recovery.max_per_stage`) to prevent infinite recovery loops. The design treats agent and validation failures as information that the system can reason about, rather than hard stops requiring human intervention.

## Iterative Improvement Loops

CLK ships two distinct iterative loop modes, both driven through the `ralph` agent.

### The Ralph Refinement Loop

The Ralph loop (`/loop ralph N` in the TUI, or `clk loop --max-iterations N` on the CLI) implements a simple but effective iterative improvement cycle. In each iteration, Ralph reads the current state files and git log, identifies one measurable improvement, and produces a plan. The engineer implements the plan, QA validates it, and the harness runs any configured validation commands. If all checks pass and the working tree has changed, the harness commits the iteration with full metadata. If validation fails, `git reset --hard` reverts the working tree to the pre-iteration HEAD, and the outcome is recorded in `experiments.jsonl` so subsequent iterations can learn from the failure without contaminating the committed project state. The loop terminates when `done.md` is created or `max_iterations` is reached.

### The Autoresearch Loop

The autoresearch loop (`/loop autoresearch N`) implements a Karpathy-style research cycle oriented toward hypothesis generation and experimental learning rather than feature delivery. Each iteration, Ralph surveys the current state to identify the highest-value open question (recorded in the project's `decisions.md` or blackboard), designs a small targeted experiment to address it, runs the experiment via ACTION blocks, and records the outcome in `experiments.jsonl` regardless of whether the experiment succeeded or failed. The philosophy is that failed experiments are useful data, and the loop accumulates a structured research log that informs subsequent iterations. Both loop modes respect the `done.md` termination condition and can be stopped gracefully via the TUI's `/stop` command, which signals the loop to halt after the current iteration completes rather than aborting mid-iteration.

## The Provider System

All agent invocations flow through a provider abstraction defined in `providers/base.py`. Each provider implements `invoke(request: AgentRequest) -> AgentResponse`, where the request carries the rendered prompt and metadata, and the response carries the text output, token counts, and a success flag. The harness ships seven provider implementations.

| Provider    | Invocation method | Notes |
|-------------|-------------------|-------|
| `shell`     | Always available  | Dummy provider; echoes prompts and writes stub files. Useful for tests and dry runs. |
| `claude`    | `claude` on PATH  | Runs `claude --print` non-interactively; supports both CLI auth and direct API key auth via the Anthropic Messages endpoint. |
| `codex`     | `codex` on PATH   | Runs `codex exec`. |
| `gemini`    | `gemini` on PATH  | Runs the Google Gemini CLI; prompt fed on stdin. |
| `pi`        | `pi` on PATH or `.clk/tools/pi/` | Extensible terminal harness. |
| `ollama`    | HTTP endpoint     | Local LLM via HTTP; no API key required. |
| `openwebui` | HTTP endpoint     | Any OpenAI-compatible server; configure `endpoint`, `api_key`, and `model` in `providers.json`. |

For the CLI-driven providers (`claude`, `codex`, `gemini`), CLK supports two authentication modes. The `cli` mode (default) spawns the provider's local CLI as a subprocess and trusts whatever session authentication that CLI already has. The `apikey` mode bypasses the local CLI entirely and calls the upstream HTTP API directly, using standard environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). This separation makes CLK usable in both developer workstation contexts (where a persistent CLI session is already authenticated) and CI/CD environments (where API keys are injected as secrets). Per-agent provider binding in `agents.json` means you can route different agents to different providers within the same workflow cycle, which is useful when you want cloud reasoning for the chief and local generation for lower-stakes implementation stages.

## The TUI Dashboard

For interactive use, CLK ships a terminal user interface (TUI, implemented in `clk_harness/tui.py` using curses) that provides live visibility into the multi-agent execution. The TUI displays a card for each active agent showing its current state (idle, working, done, or failed), a scrollable status log that mirrors the session log file, a live heartbeat indicating whether a running agent subprocess is actively streaming or silent, and a command input field styled after Claude Code's `>` prompt. A bottom band reports running totals: agent count, total tokens consumed (input and output separately), peak concurrent runs, and files written.

The TUI also supports interactive steering via typed commands:

| Command | Effect |
|---------|--------|
| `free text` | First message becomes the project idea and triggers casting + `engineering`; subsequent messages append context and re-cast + re-run. |
| `/idea <text>` | Replace the captured idea. |
| `/cast` | Force a fresh chief casting pass against current state. |
| `/roles list` | Print the current roster. |
| `/roles add NAME "description"` | Add a dynamic role. |
| `/roles drop NAME` | Remove a dynamic role (baseline agents cannot be removed). |
| `/run [workflow]` | Execute a single workflow cycle (default: `engineering`). |
| `/loop ralph N` | Start N iterations of the Ralph refinement loop. |
| `/loop autoresearch N` | Start N iterations of the autoresearch loop. |
| `/stop` | Request the active loop to halt after the current iteration. |
| `/abort` | SIGTERM any running CLI subprocess. |
| `/provider <name>` | Switch the active provider. |
| `/quit` | Exit the TUI. |

The heartbeat mechanism deserves specific mention. CLI providers stream their subprocess's stdout and stderr live to the status pane, so every line the CLI prints (authentication status messages, connection attempts, retry notices) appears within milliseconds. The heartbeat fires approximately every 15 seconds while an agent is working and distinguishes between an agent that is processing slowly and one that is genuinely hung. If a subprocess has been silent for more than two minutes, the TUI suggests typing `/abort`. This real-time observability is a significant quality-of-life improvement over systems that present a spinner with no indication of underlying activity.

## Getting Started

The fastest path is the kickoff script, which copies the harness into a fresh timestamped directory, initializes a git repository, and launches the TUI:

```bash
# Optional: set defaults non-interactively by copying .env.example to .env
./kickoff.sh "A local-first journaling app that summarizes my week"

# Or omit the prompt and type your idea into the TUI:
./kickoff.sh
```

The kickoff directory is intentionally isolated: `.clk/` holds all harness state, the project tree receives the agents' output, and the original CLK source directory is never modified.

If you prefer the command-line interface without the TUI:

```bash
./scripts/install_local.sh           # creates .clk/venv and installs PyYAML
./scripts/clk init
./scripts/clk idea "A local-first journaling app that summarizes my week"
./scripts/clk plan
./scripts/clk run
./scripts/clk loop --max-iterations 10
```

Setting `CLK_NO_TUI=true` in your environment makes `kickoff.sh` fall back to the non-interactive pipeline automatically, which is the appropriate mode for CI/CD use.

## Docker Deployment

CLK ships a `Dockerfile` for containerized use. The default mode is the interactive TUI, so you launch with `-it`. Kickoff directories are created under `workspace/` inside the container; mounting a volume there preserves them across runs.

```bash
docker build -t clk .
docker volume create clk-workspace

# Interactive TUI, with your idea passed as an argument:
docker run --rm -it \
  -v clk-workspace:/app/workspace \
  clk "A local-first journaling app that summarizes my week"

# Non-interactive CI mode with Claude API key:
docker run --rm \
  -v clk-workspace:/app/workspace \
  -e CLK_NO_TUI=true \
  -e CLK_PROVIDER=claude \
  -e CLK_AUTH_MODE=apikey \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  clk "A local-first journaling app that summarizes my week"
```

A setup wizard (`--setup`) walks through every configuration option and writes the results to a bind-mounted `.env` file, which is appropriate for first-run configuration in both local and container contexts.

## Safety and Reliability Mechanisms

CLK incorporates several safeguards designed to make autonomous operation safer without sacrificing the ability to take real action.

Failed work is never silently discarded. The Ralph loop uses `git reset --hard <pre-iteration-sha>` to revert failed iterations, and the pre-revert state is preserved in `.clk/runs/` for inspection. The backup system in `.clk/backups/` provides per-overwrite copies of every file the harness mutates, with backup filenames keyed to the run ID so you can trace a backup to the specific agent invocation that produced it.

Operations touching more than five files are logged with a warning before execution, and operations exceeding twenty-five files in a single response batch are refused entirely (the cap is configurable). This provides a meaningful check against an agent that attempts to restructure the entire project in one pass. The `run` action sanitizes shell commands before execution, rejecting `sudo` and recognizable destructive patterns.

All exceptions are caught and logged with a location-specific prefix string and a full traceback, consistent with the project's exception-handling convention: `print(f"[module:function] {e}")` followed by `traceback.print_exc()`. This means that a provider failure, a YAML parse error, or a filesystem permission issue is always surfaced with enough context to diagnose the problem without reading the full run log.

## Completion Criteria

CLK considers the project "done" when `.clk/state/done.md` exists. By convention, the harness creates this file only when the chief determines that the MVP runs locally, the test suite passes, the README explains setup, a deployment plan and checklist exist, and at least one user-facing interaction path has been implemented. These criteria are not enforced programmatically; they are encoded in the chief's system prompt as the completion standard it reasons about when deciding whether to emit `ACTION: done` or propose another workflow cycle.

## Customization

CLK is designed to be customized at every layer. Editing `.clk/prompts/` changes individual agent behavior without touching harness code. Editing `.clk/config/agents.json` rebinds specific agents to specific providers, for example routing the `engineer` agent to `claude` while keeping `researcher` on a local `ollama` model. Adding new YAML files to `.clk/config/workflows/` introduces new execution modes, accessible via `clk run --workflow NAME` or `/run workflow_name` in the TUI. Project-wide parameters including the supervise cycle cap, the recovery pass limit, the maximum dynamic role count, and the file-action batch limit are all configurable via `clk configure --set key=value`, which updates `clk.config.json` in place.

## Summary

The Cognitive Loop Kernel addresses a practical gap in the current landscape of agentic development tools: the need for a local-first, inspectable, provider-agnostic harness that can assemble a project-specific multi-agent team, execute real file operations under safety constraints, iterate toward completion through structured loops, and maintain a complete, human-readable audit trail throughout. By treating the workflow definition, agent roster, blackboard contents, and git history as first-class project artifacts, CLK makes the behavior of the multi-agent system legible and modifiable without requiring changes to the harness itself. The source is available on [GitHub](https://github.com/BillJr99/CognitiveLoopKernel) under the MIT License.
