---
title: 'Herding Agents: Multi-Agent Coordination with Herdr and Per-Agent MCP Credentials'
date: 2026-10-04
permalink: /posts/2026/10/herdr-multiagent-mcpproxy/
tags:
 - ai
 - mcp
 - agentic
 - herdr
 - opencode
 - security
---

I now run seven coding agents side by side on a small always-on Linux box: Claude Code, Codex, Antigravity, Grok Build, Hermes, GitHub Copilot, and OpenCode. [Herdr](https://herdr.dev/) keeps them organized, one labelled tab per agent, and brings them back after a reboot. They all share one [mcpproxy](/posts/2026/05/mcpproxy/) instance for tools. The part I care most about is that one of those tools talks to a service that needs a personal API key, and only one agent ever holds that key. The other six can see the tool, but they can't authenticate to the service behind it.

This post walks through how the pieces fit together, with the emphasis on that last part: scoping an MCP credential to a single agent's environment by sending it as a request header instead of storing it in the proxy.

## Why put the agents under a multiplexer

Each of these CLIs is an interactive terminal program, and each wants to keep running while it works. I could run them in plain tmux, but Herdr adds a layer that knows they are agents. After installing an agent, you install its Herdr integration:

```bash
herdr integration install claude
herdr integration install codex
herdr integration install opencode
herdr integration status
```

Integrations hook into each agent's own configuration so Herdr can report status and session identity. `herdr agent list` then tells me which tabs hold a running agent and whether one is blocked on an approval prompt. Ctrl+B followed by Q detaches and leaves everything running; typing `herdr` reattaches.

Tabs are created once, from an ordinary shell, with a label and a working directory:

```bash
response=$(herdr tab create \
  --cwd "$HOME/agents/opencode" \
  --label "opencode" \
  --no-focus)
pane=$(printf '%s' "$response" | jq -er '.result.root_pane.pane_id')
herdr pane run "$pane" opencode
```

Run that only once per agent. Rerunning it creates a duplicate tab, and as you'll see below, the startup launcher depends on each label being unique.

For phone access I use [HerdrGo](https://github.com/herdr-go/herdr-go), a Herdr plugin plus an Android app that pairs with a QR code. It gives me a terminal view of every agent, including the ones with no remote-control feature of their own. Several of the agents do have one (Claude's `/remote-control`, Copilot's `/remote on`, and Antigravity's `/remote-control on`, for example), and I use those when I want the vendor's mobile interface instead of a raw terminal.

## One agent, one working directory

Every agent launches in its own directory under `~/agents/<name>`. This turned out to matter more than I expected. Most of these CLIs decide what "resume the latest conversation" means relative to the current directory, and several ask you to trust a workspace before they'll touch it. Giving each agent its own directory keeps those histories and trust decisions separate. It also keeps one agent's scratch files out of another's way.

## Coming back after a reboot

Herdr can restore agents on its own, but I wanted a simpler rule: try to resume the latest conversation, and if that command fails, start fresh once. So I turned off Herdr's native agent relaunch in `~/.config/herdr/config.toml`:

```toml
[session]
resume_agents_on_restore = false
```

The integrations stay installed and still report status; Herdr just no longer launches the agents itself during restore.

A systemd user service (with lingering enabled, so it runs without a login) starts a Herdr client inside a tmux server on its own socket. An `ExecStartPost` step then runs a short Python launcher. The launcher asks Herdr for its tabs and panes, finds each tab by label, skips any pane that already reports an agent, and submits the agent's command into the rest. The commands live in a JSON file:

```json
{
  "workspace_root": "~/agents",
  "agents": {
    "claude":  { "resume": ["claude", "--continue"],      "fresh": ["claude"] },
    "codex":   { "resume": ["codex", "resume", "--last"], "fresh": ["codex"] },
    "copilot": { "resume": ["copilot", "--continue", "--remote"],
                 "fresh":  ["copilot", "--remote"] },
    "opencode": {
      "resume": ["/bin/bash", "-c",
        "set -a; source \"$HOME/.config/opencode/service.env\"; set +a; exec opencode --standalone"],
      "fresh":  ["/bin/bash", "-c",
        "set -a; source \"$HOME/.config/opencode/service.env\"; set +a; exec opencode --standalone"]
    }
  }
}
```

The OpenCode entry looks different from the others on purpose. That difference is the subject of the rest of this post.

I want to be clear about what this arrangement does not do. It submits commands once, at boot. It isn't a watchdog, and it doesn't restart an agent that crashes later. Resuming a conversation also doesn't mean an interrupted task picks up where it left off. And a resume can fail for reasons that have nothing to do with missing history (an expired login, say), in which case the fresh attempt will usually fail the same way. After a reboot I still check `herdr agent list` and glance at each tab.

## Sharing tools through one MCP proxy

All seven agents can reach the same tool server. mcpproxy runs in a Docker container with its ports published only on `127.0.0.1`, so nothing outside the machine can reach it directly, and it restarts with Docker (`--restart unless-stopped`). Each tool provider is a YAML file in a mounted `tools/` directory, and the [earlier post](/posts/2026/05/mcpproxy/) covers how that works.

That post also covers secret injection: a provider declares which handler arguments come from environment variables, the proxy fills them in at call time, and the model never sees the values in a tool schema. That design keeps keys away from the model. It doesn't keep them away from other clients. If the key sits in the proxy's `.env`, every agent that connects to the proxy can call the tool with it.

For most of my tools, that's fine. For one service it isn't.

## Scoping a credential to one agent

The service in question holds data I don't want six general-purpose agents poking at, and its API key is mine personally. I want exactly one agent to be able to use it. The other agents should see a tool that fails to authenticate.

### Let the caller supply the key

mcpproxy providers can declare a secret in two ways at once: a server-side environment variable and a request header supplied by the caller. A provider's `secrets` block looks like this:

```yaml
secrets:
  env:
    api_url: SERVICE_API_URL
    api_key: SERVICE_API_KEY
  headers:
    api_key: X-MCPProxy-Service-Key
```

Both `api_url` and `api_key` become handler arguments. `api_url` always comes from the proxy's environment. `api_key` can come from `SERVICE_API_KEY` on the server or from the `X-MCPProxy-Service-Key` header on the incoming MCP request.

The trick is to set only the first one. The proxy's `.env` gets the base URL, which is not a secret, and deliberately leaves the key out:

```dotenv
SERVICE_API_URL=https://service.example.com
# SERVICE_API_KEY is intentionally not set here.
```

Now the proxy has no credential of its own for this service. A request authenticates only if the client brings the key in the header.

### Give the key to one agent only

The key lives in an environment file that belongs to OpenCode, created with mode `0600` and never committed anywhere:

```bash
umask 077
mkdir -p ~/.config/opencode
touch ~/.config/opencode/service.env
chmod 600 ~/.config/opencode/service.env
```

It holds a single line, `SERVICE_API_KEY=...`. OpenCode's global config then registers mcpproxy as a remote MCP server and forwards that variable as the header:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "mcpproxy": {
        "type": "remote",
        "url": "http://127.0.0.1:8888/mcp",
        "oauth": false,
        "headers": {
          "X-MCPProxy-Service-Key": "{env:SERVICE_API_KEY}"
        }
      }
    }
  }
}
```

The `{env:...}` substitution means the config file itself contains no secret; it only names the variable.

The last piece is the launch command from the JSON above. Herdr starts OpenCode through a small Bash wrapper that sources `service.env` with `set -a` (so every assignment is exported) and then `exec`s OpenCode. The variable exists in OpenCode's process and its children, and nowhere else. None of the other six launch commands source that file, so none of those agents ever has `SERVICE_API_KEY` in its environment. They can still list and call the tool through mcpproxy. Without the header, the call has no key and the service rejects it.

Two properties of this setup are deliberate. First, because OpenCode inherits the variable, shell commands that OpenCode runs can use the key too, so a script it writes against the same API works without any extra setup. Second, `exec` replaces the wrapper shell, so no extra Bash process sits around holding a copy of the environment.

### Checking it without printing the key

I verify each layer without echoing secrets to the terminal:

```bash
# The proxy has the URL but no fallback key.
grep -q '^SERVICE_API_URL=.' ~/.config/mcpproxy/.env \
  && echo 'SERVICE_API_URL=set' || echo 'SERVICE_API_URL=MISSING'
grep -q '^SERVICE_API_KEY=.' ~/.config/mcpproxy/.env \
  && echo 'WARNING: fallback key present' || echo 'fallback key intentionally absent'

# OpenCode, launched the same way Herdr launches it, can reach the proxy.
/bin/bash -c '
  set -a; source "$HOME/.config/opencode/service.env"; set +a
  test -n "$SERVICE_API_KEY" && echo "SERVICE_API_KEY=set"
  exec opencode mcp list
'
```

After that, a read-only tool call from inside OpenCode confirms that the header made it through and the service accepted it. The same call from another agent should fail to authenticate, which is the result I want.

### What this does and doesn't protect against

This is least privilege by process environment on a single-user machine. It is not a hard security boundary, and I don't treat it as one.

It keeps the key out of six agents' environments, which means they can't use it by accident and can't leak it through a tool that dumps environment variables. It keeps the key out of the proxy's configuration, so the proxy can't hand it to whoever connects. And the key never appears in a tool schema the model can read.

It does not stop a determined process running as the same Unix user. Any agent with shell access could, in principle, read `~/.config/opencode/service.env` directly. The header also travels as plain HTTP, which is acceptable only because the proxy listens on loopback and nothing else on the box is untrusted. If I needed isolation against the other agents themselves, I would run them as separate Unix users or in separate containers. For my purpose, keeping a sensitive tool out of reach of agents that have no business using it, process scoping is enough.

One more layer helps when the service returns personal information. My provider for that service pseudonymizes personal identifiers before they reach the model, using an HMAC keyed by a stable secret that lives only on the proxy side. That secret is not a credential for the service, so it can sit in the proxy's `.env` without widening access. It has to stay stable, though, or the pseudonyms change from one session to the next.

## A few practical notes

After a reboot, Herdr and OpenCode are often up before Docker has finished starting mcpproxy. On my machine the proxy takes about a minute. If OpenCode's `/mcps` view shows the proxy disconnected right after boot, I wait and check again before assuming something broke.

Some values end up in two places. OpenCode's config pins its provider endpoint and model ID literally, and I keep matching copies in the environment file for shell scripts. When one changes, both have to change in the same edit, followed by an OpenCode restart.

Herdr integrations change between releases. After updating Herdr or an agent, I run `herdr integration status` and reinstall anything that's out of date, and I read the changes before applying them to an agent whose config I've customized.

## References

- [Herdr documentation](https://herdr.dev/docs/install/), including the [CLI reference](https://herdr.dev/docs/cli-reference/), [integrations](https://herdr.dev/docs/integrations/), and [session restoration](https://herdr.dev/docs/session-state/)
- [HerdrGo](https://github.com/herdr-go/herdr-go)
- [OpenCode V2 configuration](https://opencode.ai/v2/docs/config/) and [MCP servers](https://opencode.ai/v2/docs/mcp-servers/)
- [mcpproxy on GitHub](https://github.com/BillJr99/mcpproxy) and the [earlier post](/posts/2026/05/mcpproxy/) describing it
