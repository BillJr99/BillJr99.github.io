---
title: 'OSScreenObserver: Giving AI Agents Eyes and Hands on Your Desktop'
date: 2026-05-11
permalink: /posts/2026/05/os-screen-observer/
tags:
 - ai
 - agents
 - mcp
 - accessibility
 - python
---

Most AI agents, whether a
large language model assistant running locally or a cloud-hosted agentic framework, have no reliable way to see or
interact with the desktop applications running on the machine they are supposed to be helping with. They can read
files, call APIs, and run shell commands, but they cannot observe that a dialog box appeared, that a form field is
waiting for input, or that an application is in a specific state.
[OSScreenObserver](https://github.com/BillJr99/OSScreenObserver) is a prototype that changes that. It exposes the
operating system's UI accessibility tree, textual descriptions from multiple sources, and ASCII spatial sketches of
the current screen layout through two simultaneous interfaces: a browser-based web inspector for humans and an MCP
sees are always consistent.

> **Experimental software — use at your own risk.**
> This is a research prototype. It is not intended for, and has not been
> evaluated or deemed suitable for, any particular purpose, production
> use, or critical workload. No warranty is provided, express or implied.
> By using this software you accept all associated risks. In particular, 
> I sandbox this software and use it only with local AI 
> to isolate the environment and to reduce the risk of leaking
> sensitive information from the desktop environment.
>
> Contributions, bug reports, and ideas are very welcome — feel free to
> open an issue or pull request!

## The Problem: Agents Without Peripheral Vision

The practical limitation that motivated this project is easy to state. You are running an AI agent that is supposed to
 help you complete a task in a desktop application. The agent can reason about what to do. It can call tools. But it
cannot see the application. It cannot verify that a dialog appeared after it clicked a button. It cannot read the text
 that is currently visible on screen. It cannot detect that the application has changed state between one observation
and the next. Without that feedback loop, agentic workflows that involve desktop applications either require the human
 to narrate the screen state continuously or break silently when an unexpected dialog or error appears.

The two standard approaches to this problem, taking screenshots and reading them with a vision model, and using the
operating system's accessibility API to read the UI element tree, are complementary rather than competing. Screenshots
 capture everything visible but require a model call to interpret. Accessibility trees give structured, queryable
information about UI elements but miss applications that do not instrument the accessibility API. OCR bridges the gap
for applications that are neither fully instrumented nor processed by a vision model. OSScreenObserver supports all
three modalities and lets the calling agent choose which one to use, or use all three in combination.

## Architecture: Two Interfaces, One Observer

The architecture follows a principle that turns out to matter a great deal in practice: any new capability must land
simultaneously on both the REST API and the MCP server, backed by shared logic. There is no divergence between what
you can do from a browser and what an agent can do over MCP.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  main.py                                                                │
│  ┌──────────────────────┐      ┌───────────────────────────────────┐    │
│  │  Flask web inspector │      │  MCP stdio server                 │    │
│  │  (background thread) │      │  (main thread, stdin/stdout)      │    │
│  └──────────┬───────────┘      └──────────────────┬────────────────┘    │
│             │                                     │                     │
│             └──────────────┬──────────────────────┘                     │
│                            ▼                                            │
│                    ScreenObserver                                       │
│                   /      │       \                                      │
│          Accessibility  ASCII    Description                            │
│             Tree      Renderer   Generator                              │
│           (observer)             (description)                          │
│                                  ┌──── accessibility (tree prose)       │
│                                  ├──── ocr (Tesseract)                  │
│                                  └──── vlm (Claude Vision)              │
└─────────────────────────────────────────────────────────────────────────┘
```

The `ScreenObserver` facade sits below both interfaces and provides three types of observation: the accessibility
element tree (structured JSON that describes every visible UI element, its role, name, value, bounds, and parent-child
 relationships), a textual description generated from the tree, from OCR, or from a vision language model, and an
ASCII spatial sketch that renders the layout of the screen as a character grid using Unicode box-drawing characters.
The sketch is more useful than it sounds: it gives an agent a token-efficient representation of the spatial
arrangement of UI elements without requiring image processing.

## Observation Modalities

### Accessibility Tree

On Windows, the accessibility tree is populated using the UI Automation API, which gives full element-level
information for any application that instruments UIA. This includes most standard Windows applications: browsers,
Office applications, system dialogs, and many third-party tools. The tree traversal respects a configurable maximum
depth to avoid excessive latency on complex windows such as a browser with many DOM-mapped UIA nodes.

On macOS and Linux, window enumeration and screenshot capture are fully functional. Full accessibility tree support
requires additional platform libraries (pyobjc on macOS for the AX API, pyatspi on Linux for AT-SPI), and the adapter
stubs in `observer.py` provide the correct extension points for anyone who wants to contribute those implementations.

### OCR

Tesseract-backed OCR runs on a screenshot of the target window and extracts text with per-word confidence scores.
Words below a configurable confidence threshold are discarded. OCR is the most broadly applicable modality: it works
on any application regardless of accessibility instrumentation, though it obviously captures only visible text and not
 the structural relationships between elements.

### Vision Language Model Descriptions

When `vlm.enabled` is set to `true` in `config.json` and an Anthropic API key is present, the server can send a
screenshot to Claude and request a structured description of what is visible. The VLM description is the richest of
the three modalities in terms of semantic content, and the most expensive in terms of latency and token cost. It is
best reserved for situations where the accessibility tree is sparse (applications that do not instrument UIA), OCR is
insufficient (images, icons, non-text UI elements), or the agent needs a holistic interpretation of what is happening
on screen rather than a list of element properties.

## MCP Integration

The MCP server speaks JSON-RPC 2.0 over stdin/stdout and is compatible with Claude Desktop and Claude Code. Adding it
to the Claude Desktop configuration exposes a set of tools that an agent can call to observe and interact with the
desktop:

```json
{
  "mcpServers": {
    "os-screen-observer": {
      "command": "python",
      "args": [
        "/absolute/path/to/screen_observer/main.py",
        "--mode", "both"
      ]
    }
  }
}
```

The tool surface covers observation and interaction:

| Tool | Description |
|---|---|
| `list_windows` | Enumerate all visible top-level windows |
| `get_window_structure` | Full accessibility element tree as JSON |
| `get_screen_description` | Prose description (accessibility / ocr / vlm / combined) |
| `get_screen_sketch` | ASCII spatial layout diagram |
| `get_screenshot` | Screenshot as base64 PNG |
| `get_full_screenshot` | Screenshot + ASCII sketch in one call |
| `get_visible_areas` | Visible non-occluded bounding boxes for a window |
| `bring_to_foreground` | Raise a window above others |
| `click_at` | Click at pixel coordinates |
| `type_text` | Type text into the focused element |
| `press_key` | Press a key combination |
| `scroll` | Scroll the mouse wheel at an optional screen position |

The get_full_screenshot tool is particularly useful for agentic workflows because it combines a screenshot with an
ASCII sketch in a single call, giving the agent both a pixel-level image and a token-efficient structural
representation without two round-trips.

## Agentic Features

The current codebase is a working prototype. A parallel design document, agentic_features_design.md, specifies a
production-grade feature set organized into six implementation phases. The decisions in that document reflect what it
actually takes to build a reliable agentic observation loop rather than a demo.

### Stable window identity

The prototype uses positional window indices, which break silently when windows open, close,
or reorder between tool calls. The agentic design introduces window_uid, a stable opaque identifier that persists
until the window closes. On Windows it is win:{pid}:{hwnd}; on macOS, mac:{cg_window_number}; on Linux,
x11:{wmctrl_id}. Every tool that accepts a window index also accepts a window UID, and a stale UID returns a typed
WindowGone error rather than silently operating on the wrong window.

### Element selectors

Clicking at pixel coordinates is brittle. The agentic design specifies a selector grammar, both
XPath-ish and CSS-ish, both compiling to the same AST, that lets an agent refer to elements by their role, name,
value, or ancestry path through the tree. Window[name="Notepad"]/Pane/Button[name="OK"] is stable across window moves
and size changes in a way that a pixel coordinate is not.

### ActionReceipt

Every input action, click, type, key press, scroll, returns a structured receipt that includes the
before and after tree hashes, whether the tree changed as a result of the action, and whether any new dialogs
appeared. This gives an agent the feedback it needs to decide what to do next without a separate observation call.

### Observe with diff

Full tree snapshots are expensive in tokens. The agentic design specifies that every tree-producing
 tool returns a tree_token, and that passing since=<tree_token> returns only a diff against the previous observation.
The diff format is a custom structure by default, with an option to request RFC 6902 JSON Patch instead.

### Wait and synchronize

Agents cannot reliably click a button and immediately check the result, because the result may
not be visible yet. The wait_for tool takes a list of conditions, element appears, element disappears, text becomes
visible, window appears, tree changes, and polls until one of them is satisfied or a timeout is reached. The response
includes which condition matched and how many polls it took.

### Typed error taxonomy

Rather than returning a generic error string, every failure returns a structured object with a
code, a recoverable flag, and a suggested_next_tool. ElementNotFound suggests find_element. ElementOccluded suggests
bring_to_foreground. ConfirmationRequired suggests propose_action. An agent that branches on error.code can recover
from most transient failures without human intervention.

### Record, replay, and evaluation

Building an evaluation substrate for desktop agents requires the ability to record
what an agent did and replay it against a consistent environment. The design specifies a tracing format (JSONL with
per-step screenshots), a replay engine with per-tool comparison rules that know which fields are deterministic and
which are not, and a YAML scenario DSL for scripting mock environments with state-machine reactions. An agent can be
evaluated against a scripted scenario, its trace replayed in verify mode, and the divergences surfaced as structured
data.

### Confirmation tokens

Some actions are destructive. The confirmation token flow lets an agent propose an action and
receive a token bound to the target element's position and identity. The actual action only proceeds if the agent
presents a valid, unexpired token and the element has not moved by more than a configurable pixel tolerance. This is a
 lightweight safeguard against the category of error where an agent clicks the wrong thing because the UI shifted
between the proposal and the execution.

### Redaction

Screen content may contain sensitive information: passwords, PINs, SSNs, anything that should not appear in
 a trace or in the context window of a cloud-hosted model. The redaction system matches element names, values, OCR
text, and window titles against configurable patterns and replaces matches with a replacement string before they
appear in any tool response or trace entry. Screenshot blur is available as an opt-in for visual redaction.

## The Web Inspector

The web inspector at `localhost:5001` provides five tabs for human-facing observation.

The `STRUCTURE` tab renders the accessibility element hierarchy as an interactive collapsible JSON tree. This is the
fastest way to understand what elements a particular application exposes and how they are organized.

The `DESCRIPTION` tab shows a prose description of the selected window, with a mode selector that switches between
accessibility tree prose, OCR output, VLM output, and a combined view.

The `SKETCH` tab renders the ASCII spatial diagram of the window layout, the same output that the get_screen_sketch MCP
tool returns.

The `SCREENSHOT` tab shows the pixel screenshot alongside visible-area bounding boxes and the ASCII sketch in a single
panel.

The `ACTIONS` tab provides a UI for clicking at coordinates, typing text, and pressing key combinations, which is useful
 for testing input flows interactively before encoding them in an agent script.

The sidebar lists all visible windows. Clicking one selects it, and all tabs update to reflect the selected window.
Auto-refresh polls every three seconds.

## Mock Mode and Testing

A persistent problem with tools that depend on a running desktop is that they are difficult to test in CI.
OSScreenObserver includes a mock adapter that returns scripted window and tree data without requiring any OS access.
Tests run under --mock or via direct module imports and never need a desktop session. The CI workflow runs ruff for
linting and pytest for the test suite, with no Docker or virtual display required.

The agentic feature design extends mock mode with the scenario DSL, which lets you script a realistic application
environment with state-machine reactions: set a username field and the element's value changes; click the login button
 with the right credentials and the application transitions to the welcome screen. This is the substrate on which
agent evaluation becomes reproducible rather than dependent on whatever application happens to be running.

## Conclusion

Running OSScreenObserver against real applications quickly reveals which applications are well-instrumented for
accessibility and which are not. Standard Windows applications, system dialogs, and browsers expose rich trees.
Electron applications with custom renderers, games, and some creative tools produce sparse trees where OCR and VLM
descriptions carry most of the weight. The three-modality design is not over-engineering; it reflects the actual
distribution of desktop applications that an agent might encounter.

The prompt injection risk is worth naming explicitly: screen content is included verbatim in tool results, which means
 that malicious content visible on screen, a web page with injected text, a document with embedded instructions, could
 attempt to influence the agent's behavior. The same trust boundaries that apply to any tool that reads external
content apply here. The redaction system is a partial mitigation, but the appropriate response to this risk depends on
 the deployment context.

The setup cost is low for Windows users who want full functionality. Python, Tesseract for OCR, an Anthropic API key
for VLM descriptions if desired, and the package from the repository ([https://github.com/BillJr99/OSScreenObserver](https://github.com/BillJr99/OSScreenObserver)).
The mock mode means you can explore the API and the web inspector without any platform-specific setup at all.

What OSScreenObserver ultimately provides is a bridge between the textual nature of large language models and the inherently visual, event-driven world of desktop applications. Rather than forcing agents to reason about pixel coordinates or raw images, the accessibility tree, OCR output, and ASCII spatial sketches give them structured, token-efficient representations of the desktop that align naturally with how LLMs process information. An agent that can read the UI as text, act on it through typed tool calls, and receive structured feedback about what changed is operating in a modality much closer to its native one — and that alignment is what makes reliable agentic desktop interaction tractable rather than brittle.
