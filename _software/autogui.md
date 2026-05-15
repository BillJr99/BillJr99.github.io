---
title: "AutoGUI Desktop Agent"
excerpt: "A vendor-neutral desktop automation agent that connects any OpenWebUI-compatible LLM to OS-level controls — shell, filesystem, screenshots, accessibility-tree clicks, browser automation, and more — via a ReAct-style agentic loop."
collection: software
comments: true
tags:
  - ai
  - agentic
  - desktop
  - automation
  - python
  - typescript
---

AutoGUI is a desktop automation agent available in two forms: a standalone Python CLI/TUI agent that connects any [OpenWebUI](https://openwebui.com/) instance (or any OpenAI-compatible endpoint, including local Ollama) to your desktop, and a native TypeScript [Pi](https://pi.dev) Coding Agent extension that lets Pi own the agent workflow while AutoGUI supplies the desktop tools.

The standalone agent drives a ReAct-style loop (Reason → Act → Observe → repeat) and can run shell commands, read and write files, take screenshots, click and type via pixel coordinates or OS accessibility trees, launch programs, and inspect application UI element hierarchies — all via function-calling with any model in your OpenWebUI instance. A Playwright-backed browser tool family, Set-of-Mark visual grounding, a skill library for saving and replaying successful tool sequences, and a per-app memory store for recording quirks and failure patterns round out the feature set.

The architecture follows [UFO](https://github.com/microsoft/UFO) and [open-interpreter](https://github.com/OpenInterpreter/open-interpreter) but is provider-neutral: any model that supports OpenAI-compatible tool calling works out of the box. A FastAPI REST server wraps the agent class for programmatic task submission and live SSE event streaming.

> **⚠ Experimental Software — Use in a Sandbox**
> AutoGUI is a research prototype. It is not intended for, nor evaluated or deemed suitable for, any particular production use or critical workload. No warranty is provided, express or implied. The agent operates at OS level and can run shell commands, click anything, type anywhere, read and write files, and take screenshots. **Run it only in a sandbox, VM, or container you are willing to reset.** Restrict the API to loopback and disable shell access if you do not fully trust the task or model driving it.

This software is distributed under the [MIT License](https://opensource.org/licenses/MIT).

The package is hosted on GitHub at:

[AutoGUI Desktop Agent](https://github.com/BillJr99/AutoGUI)

## Architecture

The standalone Python agent is organized around five main components:

- **`agent.py`** — the agentic ReAct loop, with a typed-plan controller layered on top for preflight checks, per-step predicate verification, and replan-on-block
- **`tools.py`** — the tool registry: shell, filesystem, all desktop backends, Playwright browser, skill library, and app-memory tools
- **`backends/`** — platform-specific desktop automation backends for Windows (UIAutomation + SendInput), macOS (screencapture, osascript), Linux X11 (xdotool, wmctrl), and Linux Wayland (grim, ydotool, swaymsg)
- **`api.py`** — a FastAPI REST server that wraps the agent for programmatic access, running automatically in the background alongside the TUI or CLI
- **`tui.py`** — a Textual interactive terminal UI with a live status bar, tool visibility toggle, and live model picker

The Pi extension in `pi-extension/` is implemented entirely in TypeScript and brings the same desktop tools into the Pi terminal harness behind a single `/autogui` command, with no dependency on the Python agent or OpenWebUI.

## Supported Platforms

| Platform | Screenshot | Click/Type | Accessibility Tree |
|----------|-----------|------------|-------------------|
| **Windows** | pyautogui | SendInput (user32) | UIAutomation |
| **WSL** | pyautogui | pyautogui | PowerShell UIAutomation |
| **macOS** | screencapture | pyautogui | osascript |
| **Linux X11** | pyautogui | xdotool | AT-SPI |
| **Linux Wayland** | grim | ydotool | AT-SPI |

The correct backend is detected automatically at startup. No configuration is needed.

## Key Features

- **ReAct agentic loop** with a typed-plan controller, preflight resource checks, per-step predicate verification, and replan-on-block
- **A11y-first clicking** via OS accessibility APIs (UIAutomation on Windows, AT-SPI on Linux) — no pixel guessing
- **Set-of-Mark grounding** — numbered overlay on detected UI elements; model clicks by ID
- **Playwright browser tools** — real DOM/ARIA selectors for web automation
- **Skill library** — save, list, and replay successful tool sequences
- **App memory** — per-app quirk database surfaced into the planner as hints
- **Best-of-N sampling** — sample N candidate actions on uncertain steps and pick the best
- **Failure GIF recording** — rolling 5-second screen buffer flushed to animated GIF on tool failure
- **Safety countdown** — configurable N-second delay before each tool call with Escape-to-cancel
