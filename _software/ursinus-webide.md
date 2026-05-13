---
title: "Ursinus WebIDE"
excerpt: "A serverless, browser-based integrated development environment for student coding practice and rapid instructor exercise development, supporting C++, Java, JavaScript, Python, R, SQL, and more without any software installation."
collection: software
comments: true
tags:
  - education
  - technical
  - software
---

The Ursinus WebIDE is a browser-based integrated development environment developed with [Christopher Tralie](https://www.ctralie.com/) to provide low-stakes, frequently-assigned coding practice for students across the entire CS curriculum.  All code execution runs client-side inside the student's browser, so the system requires no server infrastructure beyond static web hosting — making it free to operate and freely accessible to anyone on the internet.  No software installation is required beyond an off-the-shelf web browser, supporting equity across operating systems and lower-end devices such as Chromebooks.

A demonstration of the system was presented at SIGCSE TS 2026 (55th ACM Technical Symposium on Computer Science Education) in St. Louis, MO.  The full demo page is available here:

[The Ursinus WebIDE — SIGCSE 2026 Demo](https://www.billmongan.com/talk/sigcse2026)

The project is hosted at:

[Ursinus WebIDE](https://www.billmongan.com/Ursinus-WebIDE)

## Supported Languages

C++, Java, JavaScript, WebGL, Python (Brython and Pyodide), NumPy, R, SQL, Scheme, and Prolog.

## Design Goals

The system was designed around a set of educational and operational goals:

- Provide a unified exercise template across all supported languages.
- Run entirely client-side on static pages, eliminating server maintenance costs and scaling problems.
- Remember student net IDs via cookie and support save/load of in-progress code.
- Mirror a tree-based filesystem experience within the browser to scaffold students toward local development workflows.
- Detect and handle infinite loops gracefully rather than freezing the tab.
- Display multimedia assets (images, audio) inline to support multimedia-focused courses.
- Deliver low-stakes automated feedback by detecting common mistakes and surfacing hints in a console-like output panel.
- Persist student work in the browser so students can return to exercises later.
- Connect to learning management systems (LMS) in an encrypted, FERPA-compliant way via Canvas integration.

## Student-Facing Features

### Preferences

The **View** menu exposes three persistent preferences stored in `localStorage`:

| Preference | Options |
|---|---|
| **Theme** | Dark, Light, High Contrast (low-vision-friendly gold focus rings) |
| **Font Size** | 11–24 px; also adjustable with `Ctrl+=` / `Ctrl+-` |
| **Reading Mode** | Dyslexia-friendly fonts (OpenDyslexic / Atkinson Hyperlegible), increased letter and word spacing |

### Accessibility

Every interactive element carries an `aria-label`; tab/panel pairs use the ARIA tablist pattern; the ACE editor exposes a screen-reader mode; and all keyboard-driven focus is outlined with a gold `:focus-visible` ring.  The layout is fully responsive, collapsing gracefully below ~900 px for mobile use.

### "Explain This Error" Affordance

When student code raises a recognizable runtime error, an inline **? What does this mean?** button appears next to the output line.  Clicking it expands a plain-English explanation drawn from a per-language dictionary covering common errors across Python, JavaScript, Java, C++, SQL, Scheme, and Prolog (e.g., `NameError`, `NullPointerException`, `segmentation fault`, `no such table`).  The explanation is also appended to the **Suggestions** tab so it remains visible after the console scrolls.

### Infinite-Loop Watchdog

Every **Run** click immediately displays a banner explaining how to recover if the page freezes.  For runtimes that yield to the event loop (worker-based C++, async paths), a 5-second toast and a 15-second console message with a **Reload page** button also fire.

### Inspector Panel

A bottom-panel **Inspector** tab is populated automatically after every run with three sub-views:

- **Variables** — top-level variable names, types, and values captured from the student's code (supported for Python via Brython and Pyodide, JavaScript, and others where the runtime permits introspection).
- Additional sub-views for structured output and suggestions.

### Keyboard Shortcut Overlay

Press `?` (or **Help → Keyboard Shortcuts**) to open a focus-trapped modal listing all available shortcuts.
