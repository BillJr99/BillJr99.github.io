---
title: "llmproxy"
excerpt: "An OpenAI-compatible HTTP proxy that aggregates multiple LLM providers behind a single endpoint, routing requests by provider prefix embedded in the model name."
collection: software
comments: true
tags:
  - ai
  - llm
  - technical
  - software
---

`llmproxy` is a lightweight Flask-based HTTP proxy that presents a unified OpenAI-compatible API surface in front of multiple large language model providers.  Clients that speak the OpenAI API, including LangChain, LiteLLM, Open WebUI, and Cursor, connect to `llmproxy` without modification; the proxy routes each request to the correct upstream based on a provider prefix embedded in the model name string.  For example, a client requesting the model `openrouter/anthropic/claude-3.5-sonnet` will have its request forwarded to OpenRouter with the provider prefix stripped, while a request for `ollama/llama3` will be routed to a local Ollama instance.

The server hot-reloads its configuration on each request via a modification-time cache, so provider credentials and model filters can be updated without a restart.  When gunicorn is installed, the server uses it automatically with threaded workers; otherwise it falls back to the Flask development server, which is sufficient for local use.  The `/v1/models` endpoint queries all configured providers concurrently via a thread pool, and an unreachable provider is logged as a warning and omitted from the aggregate response rather than causing an overall failure.  Streaming responses are relayed as raw SSE byte streams via `stream_with_context`, preserving upstream chunk boundaries.

A standalone test client (`llmproxy_test_client.py`) exercises all endpoints, requiring only the `requests` package, and reports pass/fail/skip results by test suite across health, error-handling, model listing, chat completion, streaming, embeddings, and optional OpenAI SDK compatibility tests.  A Docker image and `docker-compose` configuration are also provided for containerized deployment; configuration is stored in a named Docker volume and shared between setup and server containers.

The package is hosted on GitHub at:

[llmproxy](https://github.com/BillJr99/llmproxy)

## Quick Start

Install dependencies and run the interactive setup wizard:

```bash
pip install flask requests
python run.py --setup
python run.py
```

The server binds to `0.0.0.0:8080` by default.  Providers, API keys, and optional model filters are stored in `~/.config/llmproxy/config.json`.

## Model Naming Convention

All models exposed by `llmproxy` follow the pattern `<provider_name>/<upstream_model_id>`.  The proxy strips the leading provider prefix before forwarding the request to the upstream base URL.

| Proxy model string | Provider | Upstream model |
|---|---|---|
| `openrouter/anthropic/claude-3.5-sonnet` | openrouter | `anthropic/claude-3.5-sonnet` |
| `openai/gpt-4o` | openai | `gpt-4o` |
| `ollama/llama3` | ollama | `llama3` |

## API Endpoints

All endpoints mirror the OpenAI API.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check; returns provider list |
| GET | `/v1/models` | Aggregate model list from all providers |
| POST | `/v1/chat/completions` | Chat completions (streaming supported) |
| POST | `/v1/completions` | Legacy text completions |
| POST | `/v1/embeddings` | Embeddings |
| * | `/v1/<anything>` | Pass-through to upstream |

## Client Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-used",
)

response = client.chat.completions.create(
    model="openrouter/anthropic/claude-3.5-sonnet",
    messages=[{"role": "user", "content": "Hello!"}],
)
```
