---
title: "opencode-auto-models"
excerpt: "An opencode plugin that discovers the models offered by OpenAI-compatible providers, so the opencode configuration no longer needs a hand-maintained model list."
collection: software
comments: true
tags:
  - ai
  - llm
  - technical
  - software
---

`opencode-auto-models` is a plugin for the [opencode](https://opencode.ai/) coding agent that discovers the models available from OpenAI-compatible providers. Without it, every model you want to use must be listed by hand in the `models` block of the opencode configuration, and that list falls out of date whenever a provider adds or retires a model. The plugin instead asks each eligible provider for its current model list (`GET {baseURL}/models`) and adds what it finds, so the configuration names the provider once and the models follow.

One package supports both opencode generations. On opencode v1 the plugin fills each provider's model list through the configuration hook, and on opencode v2 it publishes the same inventory through v2's provider interface. Each runtime's loader calls only its own entry point, so no version detection is needed, and both entry points share one discovery core for fetching, retries, caching, credentials, filters and logging. As a result, a provider configured the same way receives the same models on either version.

The plugin is hosted on GitHub:

[opencode-auto-models](https://github.com/BillJr99/opencode-auto-models)

## Features

- **Automatic discovery:** every provider that uses the OpenAI-compatible driver, or that opts in with `autoModels: true`, contributes the models its endpoint reports.
- **Manual entries kept:** models you list yourself keep their metadata, and the discovered models are added alongside them.
- **Fast startup:** each provider's model list is cached on disk and served immediately, then refreshed in the background, so after the first run discovery adds no network request to startup. On v2 a changed list takes effect right away; on v1 it takes effect at the next start.
- **Visible failures:** the plugin logs every provider it skips and the reason, because a plugin that silently does nothing looks exactly like one that was never installed.
- **Safe defaults:** requests time out and are retried once, one failing provider cannot affect another, and API keys are never logged or cached.

## Requirements

- opencode v1 1.18.29 or newer (tested with 1.18.29 and 1.18.34), or opencode v2 2.0.x (tested with 2.0.22). Check your version with `opencode --version`.
- `git` in the environment where opencode runs, since opencode installs git plugins itself. The package is installed from git or from a local checkout; it is not published to the npm registry.

## Installation

On opencode v2, the plugin command downloads the package, installs its one dependency and adds it to your global configuration:

```bash
opencode plugin add github:BillJr99/opencode-auto-models
```

On opencode v1, add the git URL to the `plugin` array in `opencode.json`, and opencode installs it at the next start:

```json
{
  "plugin": [
    "git+https://github.com/BillJr99/opencode-auto-models.git"
  ]
}
```

A local checkout works on either version. Clone the repository, run `npm install --omit=dev` once, and point opencode at it: v1 takes the entry file (`src/index.js`), and v2 takes the `src` directory. The repository README also covers WSL and the Windows desktop app, which are separate opencode installations that each need the plugin, along with forcing a reinstall and troubleshooting an install that appears to do nothing.
