---
title: "pi-openai-compat"
excerpt: "A pi coding agent extension that registers OpenAI-compatible LLM endpoints as first-class providers inside the pi terminal harness."
collection: software
comments: true
tags:
  - ai
  - llm
  - technical
  - software
---

`@billjr99/pi-openai-compat` is an extension for the [pi](https://pi.dev) coding agent terminal harness that registers OpenAI-compatible LLM endpoints as native providers.  Once installed and configured, models from external providers appear directly in pi's `/model` list and `Ctrl+L` picker alongside the built-in Anthropic, OpenAI, and Google models, with no custom model selection UI required.  The extension uses pi's `registerProvider` API, the same mechanism pi uses internally for its first-party integrations.

Multiple providers can be active simultaneously, and their models appear together in `/model` under their respective provider labels.  On deregistration, pi's built-in `unregisterProvider` restores the original model list automatically.  Model lists are cached in a local `config.json` at startup, so no network call is required to re-register providers when pi restarts.  API keys are stored in `~/.config/pi-openai-compat/config.json`.

The extension is published to npm as a scoped package and is also installable directly from GitHub.

The extension is hosted on GitHub and published to npm:

[pi-openai-compat](https://github.com/BillJr99/pi-openai-compat) | [npm: @billjr99/pi-openai-compat](https://www.npmjs.com/package/@billjr99/pi-openai-compat)

## Installation

```bash
# From npm
pi install npm:@billjr99/pi-openai-compat

# From GitHub
pi install git:github.com/BillJr99/pi-openai-compat
```

If pi is already running when you install, type `/reload` first.

## Supported Providers

| Provider | Default base URL | Auth |
|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1` | `sk-or-...` |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `nvapi-...` |
| Nous Research Portal | `https://inference-api.nousresearch.com/v1` | Nous Portal key |
| Ollama (local) | `http://localhost:11434/v1` | Keyless |
| Custom | Any URL you supply | Optional bearer token |

## Commands

The extension provides two commands:

- **`/compat-login`**: Walks through a short wizard to select a provider, confirm the base URL, and enter an API key.  The provider's models appear in pi's `/model` command immediately, and the command can be run again to add additional providers.
- **`/compat-logout`**: Unregisters a provider.  If multiple providers are registered, the user is prompted to select which one to remove; when the last provider is removed, the previously active built-in model is restored.

## Typical Workflow

```
/compat-login
  → pick Ollama
  → press Enter to accept http://localhost:11434/v1
  → models added to /model

/model
  → select desired model

/compat-logout
  → previous model restored automatically
```
