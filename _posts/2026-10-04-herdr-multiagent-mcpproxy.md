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

I now run seven coding agents side by side on a small always-on Ubuntu server: Claude Code, Codex, Antigravity, Grok Build, Hermes, GitHub Copilot, and OpenCode. [Herdr](https://herdr.dev/) keeps them organized, one labelled tab per agent, and brings them back after a reboot. They all share one [mcpproxy](/posts/2026/05/mcpproxy/) instance for tools. One of those tools talks to a service that needs a personal API key, and only one agent ever holds that key. The other six can see the tool, but they can't authenticate to the service behind it.

This post walks through the whole build from a bare server: installing and signing in to each agent, wiring them into Herdr, making the setup survive a reboot, adding mobile access, running mcpproxy, and finally scoping an MCP credential to a single agent by sending it as a request header instead of storing it in the proxy. Everything here is generic. Substitute your own user, paths, endpoints, and keys, and never paste real credentials into a config file you might share or commit.

## The server

Any modern x86-64 Linux box with a reasonable amount of RAM will do. Mine is a small mini PC running Ubuntu Server with about 14 GiB of usable memory and some swap. The agents themselves are light, since the models run remotely; most of the memory goes to the Docker services described later.

Start with the basics:

```bash
sudo apt update
sudo apt install -y curl git ca-certificates build-essential jq tmux openssl
```

Run everything below as your ordinary user, and use `sudo` only where shown. I also recommend running each installation step separately and stopping at the first error, rather than pasting a long block and hoping.

## Installing Herdr and the agents

Every tool in this section ships a native installer, usually a one-line shell command published on the vendor's own site or in its official documentation. I'm not reproducing those commands here. Get each one from the vendor's install page (the references at the end link to the documentation), read the script before piping it to a shell, and install one tool at a time. Native installers mean most of these don't need a system-wide Node.js, and they generally drop binaries into `~/.local/bin` or a tool-specific directory under your home.

Here is what I installed, and what to know about each one.

**Herdr** is the terminal multiplexer that knows about agents. Install it first so the integrations step later has something to talk to. HerdrGo, the mobile companion, needs Herdr 0.8.2 or newer.

**Claude Code** (Anthropic) installs with a native installer from Anthropic's setup docs. Its mobile Remote Control feature needs a claude.ai subscription login; API-key authentication doesn't support it.

**Codex** (OpenAI) has a native installer linked from its GitHub repository and OpenAI's docs. You sign in with a ChatGPT account or an API key.

**Antigravity CLI** (Google) installs the `agy` command. Its documentation describes a sign-in flow that works over SSH by printing a URL and code to open on another device.

**Grok Build** (xAI) installs the `grok` command, usually under `~/.grok/bin`.

**Hermes Agent** (Nous Research) installs `hermes` and manages its own runtime dependencies. Its installer may walk you through choosing a model provider and an optional messaging integration. Pick the provider you intend to use; messaging is optional if you only want the terminal agent.

**GitHub Copilot CLI** installs `copilot` and signs in with your GitHub account.

**OpenCode** is the open, provider-agnostic agent in the group. Instead of a vendor subscription, I connect it to an OpenAI-compatible endpoint of my choosing. I use OpenCode V2, which installs under `~/.opencode/bin`. It's also the agent that ends up holding the scoped credential later in this post.

After installing, make the PATH change permanent instead of exporting it in one shell. Adjust the directories to wherever your installers actually put things:

```bash
line='export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$HOME/.grok/bin:$PATH"'
grep -qxF "$line" ~/.bashrc || printf '\n%s\n' "$line" >> ~/.bashrc
source ~/.bashrc
```

Then confirm that everything resolves:

```bash
herdr --version
claude --version
codex --version
agy --version
grok --version
copilot --version
opencode --version
hermes --help
```

### A CPU quirk with Antigravity

On my machine, `agy --version` aborted immediately with `CRNGT failed` from inside BoringCrypto. The cause is the CPU's hardware random number instruction (RDRAND), which BoringSSL checks and rejects on some processors. Masking that instruction through an OpenSSL capability variable fixed it:

```bash
OPENSSL_ia32cap='~0x4000000000000000' agy --version
```

A shell function would work interactively, but systemd services and Herdr's own launches don't read your `.bashrc` functions. A small wrapper script earlier on the PATH is more dependable, and it leaves the installer-managed binary alone:

```bash
mkdir -p "$HOME/.local/agy-compat/bin"
cat > "$HOME/.local/agy-compat/bin/agy" <<'EOF'
#!/bin/sh
exec env OPENSSL_ia32cap='~0x4000000000000000' "$HOME/.local/bin/agy" "$@"
EOF
chmod 755 "$HOME/.local/agy-compat/bin/agy"

line='export PATH="$HOME/.local/agy-compat/bin:$PATH"'
grep -qxF "$line" ~/.bashrc || printf '\n%s\n' "$line" >> ~/.bashrc
```

If you don't see the error, skip this. If you do, remember that the same directory has to appear in the PATH of the systemd service later.

## Signing in to each agent

Launch each agent once by itself, complete its sign-in, and exit before moving to the next. Several of them print a URL or device code for you to open on a phone or laptop, which works fine over SSH.

```bash
claude
codex
agy
grok
hermes
copilot
```

If Hermes still needs a model provider afterwards, `hermes setup` (or just `hermes model`) reopens that step. OpenCode is the exception here: it gets a configuration file instead of an interactive login, which I cover in its own section below.

## Herdr integrations

First launch creates each agent's configuration directory, and Herdr's integrations need those directories to exist. Once they do, install an integration for each agent:

```bash
herdr integration install claude
herdr integration install codex
herdr integration install antigravity-cli
herdr integration install grok
herdr integration install hermes
herdr integration install copilot
mkdir -p ~/.config/opencode
herdr integration install opencode
herdr integration status
```

Note that Antigravity's integration identifier is `antigravity-cli`, not `agy`. Integrations add hooks or plugins to each agent's own configuration so Herdr can report the agent's status and session identity. If you've already customized an agent's settings, look at what the integration changes before applying it.

## One tab per agent, one directory per agent

Start Herdr once to finish its onboarding, then detach with Ctrl+B followed by Q:

```bash
herdr
```

From an ordinary shell, create a labelled tab for each agent and start the agent in it. Each agent gets its own working directory under `~/agents/<name>`:

```bash
(
  set -e
  for agent in claude codex agy grok hermes copilot opencode; do
    mkdir -p "$HOME/agents/$agent"
    response=$(herdr tab create \
      --cwd "$HOME/agents/$agent" --label "$agent" --no-focus)
    pane=$(printf '%s' "$response" | jq -er '.result.root_pane.pane_id')
    herdr pane run "$pane" "$agent"
  done
)
```

Run that loop exactly once. Rerunning it creates duplicate tabs, and the startup launcher described below depends on each label being unique. The OpenCode tab starts here without its private environment file; once OpenCode is configured below, exit it and start it again with the same wrapper command the launcher uses.

Separate directories matter more than I expected. Most of these CLIs decide what "resume the latest conversation" means relative to the current directory, and several ask you to trust a workspace before they'll touch it. One directory per agent keeps those histories and trust decisions apart, and keeps one agent's scratch files out of another's way.

A few Herdr keys cover most daily use:

| Action | Keys or command |
| --- | --- |
| New tab | Ctrl+B, then C |
| Next / previous tab | Ctrl+B, then N / P |
| Split right / down | Ctrl+B, then V / minus |
| Detach, leaving everything running | Ctrl+B, then Q |
| Reattach | `herdr` |
| See which agents are running or blocked | `herdr agent list` |

Send each agent a short prompt after setting it up so it has a conversation on record to resume later, and detach rather than exiting the agents.

## Configuring OpenCode for an OpenAI-compatible provider

OpenCode's configuration is global, at `~/.config/opencode/opencode.jsonc`, even though I launch it from its own workspace directory. I point it at an OpenAI-compatible endpoint. The API key stays in an environment file, and the config only refers to it by name:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "myprovider/coder",
  "providers": {
    "myprovider": {
      "name": "My Provider",
      "env": ["MYPROVIDER_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "https://llm.example.com/api/v1",
        "apiKey": "{env:MYPROVIDER_API_KEY}"
      },
      "models": {
        "coder": {
          "modelID": "UPSTREAM_MODEL_ID",
          "name": "Coding Model",
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] }
        }
      }
    }
  }
}
```

The endpoint and model ID aren't secrets, so I pin them literally in the file. If you also keep copies of them in an environment file for scripts, change both places together whenever the endpoint or model changes, then restart OpenCode.

The environment file is private to OpenCode, created with mode `0600`, and never committed anywhere:

```bash
umask 077
mkdir -p ~/.config/opencode
touch ~/.config/opencode/service.env
chmod 600 ~/.config/opencode/service.env
nano ~/.config/opencode/service.env
```

For now it holds `MYPROVIDER_API_KEY=...`. It gains a second key in the credential-scoping section. A quick test that sources the file the same way Herdr will, without printing the key:

```bash
cd ~/agents/opencode
/bin/bash -c '
  set -a; source "$HOME/.config/opencode/service.env"; set +a
  test -n "$MYPROVIDER_API_KEY" && echo "MYPROVIDER_API_KEY=set" || echo "MYPROVIDER_API_KEY=MISSING"
  exec opencode run --standalone "Reply with exactly: PROVIDER_OK"
'
```

If the model answers `PROVIDER_OK`, the provider path works.

## Mobile access

I wanted to check on agents from my phone, and there are two layers to that.

[HerdrGo](https://github.com/herdr-go/herdr-go) is a Herdr plugin plus an Android app. It gives a terminal view of every agent, including those with no remote-control feature of their own. Install it as the same user that runs Herdr:

```bash
sudo loginctl enable-linger "$(id -un)"
herdr plugin install herdr-go/herdr-go
herdr plugin action invoke herdrgo.setup
herdr plugin action invoke herdrgo.status
herdr plugin action invoke herdrgo.pair    # shows the pairing QR again
```

Install the app from the project's releases page and scan the QR code. Treat that QR code like a password, because it contains the network credential for the bridge. Its default transport doesn't need any router port forwarding.

Several agents also have their own remote-control modes, which give you the vendor's mobile interface instead of a raw terminal:

| Agent | Turn it on | Where you use it |
| --- | --- | --- |
| Claude Code | `/remote-control`, or enable it for all sessions in `/config` | Claude mobile app or claude.ai/code |
| Codex | `codex remote-control start`, then `codex remote-control pair` (experimental) | ChatGPT app, where supported |
| Antigravity | `/remote-control on`, or launch with `--remote-control` | Printed URL in a mobile browser |
| Copilot | `/remote on`, or launch with `--remote` | GitHub Mobile, under Copilot agent sessions |
| Hermes | Its separate web dashboard and API gateway services | Browser or an OpenAI-compatible client |
| Grok Build, OpenCode | No native option that I've confirmed | HerdrGo |

None of these require permission-bypass flags. A remote connection and a conversation are separate things, too: resuming a conversation after a reboot doesn't automatically restore its remote link, so you may need to re-enable it.

Hermes's dashboard and API gateway run as their own processes, separate from the terminal agent in Herdr. If you bind the dashboard to anything other than localhost, Hermes requires you to configure authentication, and I'd keep both on a trusted LAN or VPN rather than exposing them to the internet.

## Starting everything at boot

Herdr can restore agents on its own, but I wanted a simpler rule: try to resume the latest conversation, and if that command fails, start fresh once. That takes three pieces.

### Turn off Herdr's native relaunch

In `~/.config/herdr/config.toml`, inside the existing `[session]` table:

```toml
[session]
resume_agents_on_restore = false
```

The integrations stay installed and keep reporting status. Herdr just no longer launches the agents itself during restore, so it won't compete with the launcher.

### A user service that hosts Herdr

A systemd user service starts a Herdr client inside a tmux server on its own socket, so it doesn't collide with any tmux sessions you run by hand. Lingering (enabled in the HerdrGo step above) lets user services run without a login. Create `~/.config/systemd/user/herdr-autostart.service`, adjusting the PATH to match your install locations:

```ini
[Unit]
Description=Herdr boot session and agent restoration

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=%h
Environment="PATH=%h/.local/agy-compat/bin:%h/.local/bin:%h/.grok/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/tmux -L herdr-autostart new-session -d -s agents -x 160 -y 48 %h/.local/bin/herdr
ExecStop=/usr/bin/tmux -L herdr-autostart kill-server
TimeoutStartSec=60

[Install]
WantedBy=default.target
```

Its status will read `active (exited)`, which is expected. The unit creates the background session and finishes; it isn't a watchdog for the individual agents.

### A launcher that resumes or starts fresh

The launcher reads a JSON file of commands, `~/.config/herdr/agent-startup.json`:

```json
{
  "herdr": "~/.local/bin/herdr",
  "path": "$HOME/.opencode/bin:$HOME/.local/agy-compat/bin:$HOME/.local/bin:$HOME/.grok/bin:/usr/local/bin:/usr/bin:/bin",
  "workspace_root": "~/agents",
  "ready_timeout_seconds": 45,
  "interrupt_exit_codes": [129, 130, 131, 137, 143],
  "agents": {
    "claude":  { "resume": ["claude", "--continue"],               "fresh": ["claude"] },
    "codex":   { "resume": ["codex", "resume", "--last"],          "fresh": ["codex"] },
    "agy":     { "resume": ["agy", "--continue", "--remote-control"],
                 "fresh":  ["agy", "--remote-control"] },
    "grok":    { "resume": ["grok", "--continue"],                 "fresh": ["grok"] },
    "hermes":  { "resume": ["hermes", "--continue", "--no-restore-cwd"],
                 "fresh":  ["hermes"] },
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

Hermes gets `--no-restore-cwd` so it doesn't jump back to an old conversation's directory. The OpenCode entry differs from the rest because it sources its private environment file before starting, which matters in the credential section below.

The launcher itself, `~/.config/herdr/agent-startup.py`, has two modes. In `boot` mode it waits for Herdr's tabs to appear, matches each configured agent to exactly one tab by label, skips any pane that already reports a running agent, and submits a command that re-invokes the script in `agent` mode inside each remaining pane. In `agent` mode it changes into that agent's workspace, runs the resume command, and falls back to the fresh command once if resume exits with an error. A normal exit or an interrupt leaves you at a shell instead of retrying.

```python
#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import time
import tomllib
import traceback

CONFIG = Path.home() / ".config/herdr/agent-startup.json"

def load_config():
    return json.loads(CONFIG.read_text())

def api(config, *args):
    result = subprocess.run(
        [os.path.expanduser(config["herdr"]), *args], capture_output=True,
        text=True, check=True, timeout=10,
    )
    output = result.stdout.strip()
    # Some Herdr versions return empty stdout on a successful pane run.
    if not output and args[:2] == ("pane", "run"):
        return {}
    response = json.loads(output)
    if "error" in response:
        raise RuntimeError(response["error"])
    return response["result"]

def run_agent(config, name):
    commands = config["agents"][name]
    workspace = Path(config["workspace_root"]).expanduser() / name
    workspace.mkdir(parents=True, exist_ok=True)
    os.chdir(workspace)
    environment = os.environ.copy()
    environment["PATH"] = os.path.expandvars(config["path"])
    print(f"[agent-startup] {name}: trying latest session in {workspace}", flush=True)
    child = subprocess.Popen(commands["resume"], env=environment)
    previous = signal.signal(signal.SIGINT, signal.SIG_IGN)
    try:
        status = child.wait()
    finally:
        signal.signal(signal.SIGINT, previous)
    if status == 0 or status < 0 or status in config["interrupt_exit_codes"]:
        return status if status >= 0 else 128 - status
    print(f"[agent-startup] {name}: resume exited {status}; starting fresh once", flush=True)
    command = commands["fresh"]
    os.execvpe(command[0], command, environment)

def plan(config):
    tabs = api(config, "tab", "list")["tabs"]
    panes = api(config, "pane", "list")["panes"]
    selected = []
    for name in config["agents"]:
        matches = [tab for tab in tabs if tab.get("label") == name]
        if len(matches) != 1:
            raise RuntimeError(f"Expected one tab labelled {name}; found {len(matches)}")
        members = [pane for pane in panes if pane["tab_id"] == matches[0]["tab_id"]]
        if len(members) != 1:
            raise RuntimeError(f"Expected one pane in {name}; found {len(members)}")
        selected.append((name, members[0]))
    return selected

def boot(config, apply):
    if apply:
        settings = tomllib.loads((Path.home() / ".config/herdr/config.toml").read_text())
        if settings.get("session", {}).get("resume_agents_on_restore") is not False:
            raise RuntimeError("Set [session] resume_agents_on_restore = false first")
    deadline = time.monotonic() + config["ready_timeout_seconds"]
    while True:
        try:
            selected = plan(config)
            break
        except (subprocess.SubprocessError, OSError, ValueError, KeyError, RuntimeError) as e:
            print(f"[agent-startup:boot] readiness: {e}", flush=True)
            traceback.print_exc()
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)
    for name, pane in selected:
        pane_id = pane["pane_id"]
        if pane.get("agent"):
            print(f"[agent-startup] skip {name}: agent already present in {pane_id}", flush=True)
            continue
        command = shlex.join(["/usr/bin/python3", str(Path(__file__).resolve()), "agent", name])
        print(f"[agent-startup] {'launch' if apply else 'would launch'} {name} in {pane_id}", flush=True)
        if apply:
            api(config, "pane", "run", pane_id, command)
    return 0

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    boot_parser = sub.add_parser("boot")
    boot_parser.add_argument("--apply", action="store_true")
    agent_parser = sub.add_parser("agent")
    agent_parser.add_argument("name")
    args = parser.parse_args()
    try:
        config = load_config()
        if args.mode == "agent":
            return run_agent(config, args.name)
        return boot(config, args.apply)
    except Exception as e:
        print(f"[agent-startup:main] {args.mode}: {e}", flush=True)
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

If you need the Antigravity CPU workaround, the wrapper directory in `path` covers the launcher too.

A drop-in at `~/.config/systemd/user/herdr-autostart.service.d/agent-startup.conf` runs the launcher after the tmux session starts:

```ini
[Service]
TimeoutStartSec=90
ExecStartPost=/usr/bin/python3 %h/.config/herdr/agent-startup.py boot --apply
```

Before enabling anything, do a dry run. Without `--apply`, the launcher only prints `would launch` or `skip` for each tab:

```bash
python3 -m json.tool ~/.config/herdr/agent-startup.json >/dev/null
python3 -m py_compile ~/.config/herdr/agent-startup.py
python3 ~/.config/herdr/agent-startup.py boot
systemctl --user daemon-reload
systemd-analyze --user verify ~/.config/systemd/user/herdr-autostart.service
systemctl --user enable herdr-autostart.service
```

Don't run `boot --apply` by hand while a pane has an editor or some other program open. The launcher skips panes that Herdr recognizes as agents, but it can't tell whether every other pane is sitting at a safe shell prompt. It's meant for freshly restored shells at boot.

After the next planned reboot, check the result:

```bash
herdr agent list
journalctl --user -b -u herdr-autostart.service -n 80 --no-pager
```

In `herdr agent list`, `blocked` means an agent is waiting on an approval or question, and `unknown` only means Herdr couldn't classify it, which isn't proof of failure.

This arrangement submits commands once, at boot. It doesn't restart an agent that crashes later, and resuming a conversation doesn't mean an interrupted task picks up where it left off. A resume can also fail for reasons unrelated to missing history, such as an expired login, and then the fresh attempt usually fails the same way. Workspace-trust prompts and sign-in prompts can still pause startup, so I glance at each tab after a reboot.

## Running mcpproxy

Install Docker Engine from Docker's official apt repository, following their Ubuntu instructions, and enable it so it starts at boot. I keep using `sudo docker` rather than adding my account to the `docker` group, since that group is effectively root.

mcpproxy reads its tool providers from a directory of YAML files and its secrets from an `.env` file. I keep both under `~/.config/mcpproxy`, put the containers on a private Docker network, and publish ports only on `127.0.0.1`:

```bash
mkdir -p ~/.config/mcpproxy/tools
( umask 077; touch ~/.config/mcpproxy/.env )
chmod 600 ~/.config/mcpproxy/.env
sudo docker network inspect agent-services >/dev/null 2>&1 \
  || sudo docker network create agent-services

sudo docker run -d \
  --name mcpproxy \
  --network agent-services \
  --restart unless-stopped \
  -p 127.0.0.1:8888:8888 \
  -p 127.0.0.1:8889:8889 \
  --env-file "$HOME/.config/mcpproxy/.env" \
  -e MCP_TOOL_CONFIG_DIR=/app/tools \
  -e MCP_ENV_FILE=/app/.env \
  --mount type=bind,src="$HOME/.config/mcpproxy/tools",dst=/app/tools \
  --mount type=bind,src="$HOME/.config/mcpproxy/.env",dst=/app/.env \
  ghcr.io/billjr99/mcpproxy:latest
```

The MCP endpoint is then `http://127.0.0.1:8888/mcp` and the management UI is on port 8889. From another computer, an SSH tunnel (`ssh -N -L 18889:127.0.0.1:8889 you@server`) reaches the UI without opening a port. The [earlier post](/posts/2026/05/mcpproxy/) covers how providers are written and how its secret injection works: a provider declares which handler arguments come from environment variables, the proxy fills them in at call time, and the model never sees the values in a tool schema.

That keeps keys away from the model. It doesn't keep them away from other clients. If a key sits in the proxy's `.env`, every agent that connects to the proxy can call the tool with it. For most of my tools, that's fine. For one service it isn't.

## Scoping a credential to one agent

The service in question has a personal API key and holds data that six general-purpose agents have no reason to touch. I want exactly one agent to be able to use it, and the others to see a tool that fails to authenticate.

### Let the caller supply the key

mcpproxy providers can declare a secret in two ways at once: a server-side environment variable and a request header supplied by the caller. The provider's `secrets` block looks like this:

```yaml
secrets:
  env:
    api_url: SERVICE_API_URL
    api_key: SERVICE_API_KEY
  headers:
    api_key: X-MCPProxy-Service-Key
```

Both `api_url` and `api_key` become handler arguments. `api_url` always comes from the proxy's environment. `api_key` can come from `SERVICE_API_KEY` on the server or from the `X-MCPProxy-Service-Key` header on the incoming MCP request.

The trick is to set only the first. The proxy's `.env` gets the base URL, which isn't a secret, and leaves the key out entirely:

```dotenv
SERVICE_API_URL=https://service.example.com
# SERVICE_API_KEY stays unset here.
```

Now the proxy has no credential of its own for this service. A request authenticates only if the client brings the key in the header. After changing the `.env`, restart the container so it picks up the new values.

### Give the key to one agent only

Add the service key to OpenCode's private environment file, next to the provider key:

```dotenv
MYPROVIDER_API_KEY=...
SERVICE_API_KEY=...
```

Then add an `mcp` block to `opencode.jsonc` that registers mcpproxy as a remote MCP server and forwards that variable as the header:

```jsonc
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
```

As with the provider key, the `{env:...}` substitution means the config file names the variable but contains no secret.

The last piece is OpenCode's launch command in `agent-startup.json`. Herdr starts OpenCode through a small Bash wrapper that sources `service.env` with `set -a` (so every assignment is exported) and then `exec`s OpenCode. The variable exists in OpenCode's process and its children, and nowhere else. None of the other six launch commands source that file, so none of those agents ever has `SERVICE_API_KEY` in its environment. They can still list and call the tool through mcpproxy, but without the header the call has no key and the service rejects it.

Two side effects follow from this. Because OpenCode's children inherit the variable, shell commands that OpenCode runs can use the key too, so a script it writes against the same API works without extra setup. And because `exec` replaces the wrapper shell, no extra Bash process sits around holding a copy of the environment.

### Checking it without printing the key

I verify each layer without echoing secrets to the terminal:

```bash
# The proxy has the URL but no fallback key.
grep -q '^SERVICE_API_URL=.' ~/.config/mcpproxy/.env \
  && echo 'SERVICE_API_URL=set' || echo 'SERVICE_API_URL=MISSING'
grep -q '^SERVICE_API_KEY=.' ~/.config/mcpproxy/.env \
  && echo 'WARNING: fallback key present' || echo 'fallback key absent'

# OpenCode, launched the same way Herdr launches it, can reach the proxy.
cd ~/agents/opencode
/bin/bash -c '
  set -a; source "$HOME/.config/opencode/service.env"; set +a
  test -n "$SERVICE_API_KEY" && echo "SERVICE_API_KEY=set"
  exec opencode --print-logs mcp list
'
```

Inside the OpenCode tab, `/mcps` should show mcpproxy connected. A read-only tool call against the service then confirms that the header made it through and the service accepted it.

### What this does and doesn't protect against

> **A disclaimer before relying on this.** Confining a credential to one Herdr environment does not completely isolate it. The key can still leak: OpenCode, or a script it runs, could print it, write it to a file, or include it in a log that another agent later reads. The other agents can also reach it indirectly, because any agent with a shell can start OpenCode with the same wrapper command, or use `herdr pane run` to type a request into OpenCode's tab and let OpenCode make the call on its behalf. What this setup does give me is a meaningful layer of protection. I can define exactly which functionality the service exposes through an MCP provider, and that provider acts as a partial firewall: the other agents see a tool that refuses to authenticate, rather than an open path to the service and its data.

This is least privilege by process environment on a single-user machine. It is not a hard security boundary, and I don't treat it as one.

It keeps the key out of six agents' environments, so they can't use it by accident and can't leak it through a tool that dumps environment variables. It keeps the key out of the proxy's configuration, so the proxy can't hand it to whoever connects. And the key never appears in a tool schema the model can read.

It does not stop a determined process running as the same Unix user. Any agent with shell access could, in principle, read `~/.config/opencode/service.env` directly. The header also travels over plain HTTP, which is acceptable only because the proxy listens on loopback. If I needed isolation from the other agents themselves, I would run them as separate Unix users or in separate containers. For my purpose, keeping a sensitive tool out of reach of agents that have no business using it, process scoping is enough.

One more layer helps when a service returns personal information. My provider for that service pseudonymizes personal identifiers before they reach the model, using an HMAC keyed by a stable secret that lives only on the proxy side. That secret isn't a credential for the service, so it can sit in the proxy's `.env` without widening access. It has to stay stable, though, or the pseudonyms change from one session to the next.

## Other services on the same network

mcpproxy isn't the only container on the box. A few other self-hosted services give the agents and mcpproxy providers capabilities that would otherwise mean calling a third-party API:

- **SearXNG**, a metasearch engine. Out of the box it only serves HTML, so I enabled JSON output in its `settings.yml` (adding `json` alongside `html` under `search.formats`), which lets tools call it as a search API.
- **Firecrawl**, which scrapes pages and returns clean Markdown. I run its Docker Compose stack pinned to a specific release, with reduced worker counts so it shares the machine politely with everything else. Its self-hosted API has no authentication, which is one more reason it stays on loopback.
- **Camofox**, a browser automation service with a small HTTP API, built from the upstream source.
- **llmproxy**, a small OpenAI-compatible LLM proxy of my own, with an admin page for its provider settings.

These all follow the same pattern as mcpproxy. Each publishes its ports on `127.0.0.1` only, so nothing outside the machine can reach them, and from another computer I use an SSH tunnel. They also share the private `agent-services` Docker network, where containers reach each other by name (an mcpproxy provider can call `http://searxng:8080` directly, for example) without any extra published ports. Most use `--restart unless-stopped` or `--restart always`, so Docker brings them back after a reboot. Firecrawl's Compose stack is the exception in my setup; I start it by hand when I need it.

None of these are wired into the agents automatically. An agent reaches one only through a tool I've written for it in mcpproxy or by calling it directly, which is the same choke point the credential scoping above relies on.

## Day-to-day notes

After a reboot, Herdr and OpenCode are often up before Docker has finished starting mcpproxy. On my machine the proxy takes about a minute. If `/mcps` shows the proxy disconnected right after boot, wait and check again before assuming something broke.

If an OpenCode tab reports `opencode: not found`, the launcher's `path` is missing OpenCode's install directory. Using the absolute binary path in the launch command avoids depending on `.bashrc` at all.

Herdr integrations change between releases. After updating Herdr or an agent, run `herdr integration status` and reinstall anything that's out of date, checking the changes first on any agent whose config you've customized. When something misbehaves, inspect it before reinstalling; reinstalling or deleting configuration shouldn't be the first troubleshooting step, since it can throw away sign-ins and conversation history.

Finally, keep every environment file at mode `0600`, keep them out of version control, and redact secrets before sharing logs or asking anyone, human or agent, for help.

## References

- [Herdr documentation](https://herdr.dev/docs/install/), including the [CLI reference](https://herdr.dev/docs/cli-reference/), [integrations](https://herdr.dev/docs/integrations/), and [session restoration](https://herdr.dev/docs/session-state/)
- [HerdrGo](https://github.com/herdr-go/herdr-go)
- [Claude Code setup](https://code.claude.com/docs/en/setup) and [Remote Control](https://code.claude.com/docs/en/remote-control)
- [Codex](https://github.com/openai/codex)
- [Antigravity CLI installation](https://antigravity.google/docs/cli/install/) and [remote control](https://antigravity.google/docs/remote-control?tab=cli)
- [Grok Build](https://docs.x.ai/build/overview)
- [Hermes Agent installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation) and [web dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- [GitHub Copilot CLI installation](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) and [remote steering](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/steer-remotely)
- [OpenCode V2 configuration](https://opencode.ai/v2/docs/config/), [providers](https://opencode.ai/v2/docs/providers/), and [MCP servers](https://opencode.ai/v2/docs/mcp-servers/)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [mcpproxy on GitHub](https://github.com/BillJr99/mcpproxy) and the [earlier post](/posts/2026/05/mcpproxy/) describing it
