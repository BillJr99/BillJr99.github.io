---
title: "OSScreenObserver"
excerpt: "A cross-platform prototype that exposes the operating system's UI accessibility tree, textual descriptions, and ASCII spatial sketches through a browser-based dashboard and an MCP stdio server for AI agent integration."
collection: software
comments: true
tags:
  - ai
  - agentic
  - technical
  - software
---

`OSScreenObserver` is a Python prototype that exposes the operating system's UI accessibility tree, textual descriptions, and ASCII spatial sketches through two simultaneous interfaces: a browser-based web inspector at `localhost:5001` for human inspection, and an MCP (Model Context Protocol) stdio server compatible with Claude Desktop and Claude Code for AI agent integration.  Both interfaces share the same underlying observer and can run at the same time.

The system supports three description modalities, and `get_screen_description` always returns every source that is available on the current platform in a single call.  The accessibility tree modality traverses the OS accessibility API (UIA on Windows, AXUIElement on macOS, AT-SPI on Linux) to produce a structured JSON element hierarchy.  The OCR modality uses Tesseract to extract text from a screenshot.  The VLM modality optionally passes a screenshot to Claude Vision for a natural-language description.  These results are combined and labeled by source in both the web inspector's Description tab and in MCP tool responses.

The ASCII sketch renderer produces a Unicode box-drawing spatial layout diagram of a window's element positions, suitable for consumption by a language model with no image input capability.  All inputs and outputs degrade gracefully: if a library is not installed or a platform capability is unavailable, the server continues running and returns whatever it can.

Platform-specific adapters are provided for Windows (full UIA and pywinauto support), macOS (Quartz and pyobjc AX accessibility tree), Linux (wmctrl and pyatspi), and WSL (PowerShell fallback for screenshots and window enumeration when no X11 display is available).  A mock adapter allows full development and testing without any OS-level access.

The MCP integration enables AI agents to list visible windows, retrieve accessibility trees, request ASCII sketches and screenshots, obtain combined textual descriptions, enumerate visible bounding boxes, bring windows to the foreground, and execute click, type, key, and scroll actions against real OS controls.

The package is hosted on GitHub at:

[OSScreenObserver](https://github.com/BillJr99/OSScreenObserver)

## Architecture

```
main.py
  ┌── Flask web inspector (background thread)
  └── MCP stdio server (main thread, stdin/stdout)
         └── ScreenObserver
              ├── Accessibility Tree (observer)
              ├── ASCII Renderer (ascii_renderer)
              └── Description Generator (description)
                   ├── accessibility (tree prose)
                   ├── ocr (Tesseract)
                   └── vlm (Claude Vision)
```

## Quick Start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
# Web inspector: http://127.0.0.1:5001
# MCP server:    stdin/stdout
```

## MCP Integration

Add the following block to your Claude Desktop configuration to make the MCP tools available in a conversation:

```json
{
  "mcpServers": {
    "os-screen-observer": {
      "command": "python",
      "args": ["/absolute/path/to/screen_observer/main.py", "--mode", "both"]
    }
  }
}
```

## Available MCP Tools

| Tool | Description |
|---|---|
| `list_windows` | Enumerate all visible top-level windows |
| `get_window_structure` | Full accessibility element tree as JSON |
| `get_screen_description` | Combined description from all available sources |
| `get_screen_sketch` | ASCII spatial layout diagram |
| `get_screenshot` | Screenshot as base64 PNG |
| `get_full_screenshot` | Screenshot and ASCII sketch in one call |
| `get_visible_areas` | Visible (non-occluded) bounding boxes for a window |
| `bring_to_foreground` | Raise a window using the platform focus API |
| `click_at` | Click at pixel coordinates |
| `type_text` | Type text into the focused element |
| `press_key` | Press a key combination (e.g., `ctrl+c`) |
| `scroll` | Scroll the mouse wheel at a screen position |

## Platform Support

| Feature | Windows | macOS | Linux | WSL |
|---|---|---|---|---|
| Window enumeration | Full | Full | Full | Full |
| Accessibility tree | Full UIA | AXUIElement | AT-SPI | Stub (no X11) |
| Screenshot | Full | Full | Full | mss or PowerShell |
| OCR | Full | Full | Full | Full |
| VLM description | Full | Full | Full | Full |
| ASCII sketch | Full | Full | Full | Full |
| Input actions | Full | Full | Full | Requires DISPLAY |

## Known Limitations

Screen content is included verbatim in MCP tool results.  Malicious content on screen could attempt to influence the AI's behavior; appropriate trust boundaries should be applied before deploying this server in production contexts.  Input action tools (`click_at`, `type_text`, `press_key`) execute real OS input events and should be used with appropriate authorization controls.
