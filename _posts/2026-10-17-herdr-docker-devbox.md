---
title: 'A Herdr Devbox: Running Several Coding Agents in One Container, With You Approving Every Host Access'
date: 2026-10-17
permalink: /posts/2026/10/herdr-docker-devbox/
tags:
 - ai
 - agentic
 - herdr
 - docker
 - security
 - sandboxing
 - opencode
---

Coding agents are useful because they can read your files and run commands. That is also what makes them a little uncomfortable to run on a machine with real data on it. A model can misread an instruction, or a file it opens can contain instructions of its own, and an agent running as you can do anything you can do. When I run several agents at once, the question gets bigger: each one wants access to the same drives, and I would like them to cooperate without all of them being able to see everything.

This post describes a setup I built to deal with that. Everything runs in a single Docker container. Seven agents (Claude Code, Codex, Antigravity, Grok, OpenCode, pi, and Qwen Code) each get their own Linux user, their own home directory, and a terminal tab managed by [Herdr](https://herdr.dev/). None of them can see my Windows drives. When one needs a file, it asks a small broker program, and the request sits there until I approve it, either on a web page or by typing a six-digit code into Claude from my phone. Every file in the project is at the bottom of this post, so you can build it yourself.

I'll go through it in the order I'd want it explained to me: first the ideas you need (containers, users, permissions, sandboxes), then how to build and run it, then how each piece works and why I made the choices I did. If you already know Docker and Linux permissions, skip ahead to "The approval broker."

If you've read my [earlier post on Herdr and per-agent MCP credentials](/posts/2026/10/herdr-multiagent-mcpproxy/), this is a different approach to a related problem. That post fenced agents apart on a server by giving each its own credentials. This one puts them in a container and puts a human approval step between them and the host.

## What we're building

Here is the whole picture. The sections after this one fill it in.

```text
 Windows host (WSL2)                      one Docker container
 -------------------                      ------------------------------------------
  C:\  D:\  X:\  (drives)                  root: controller + approval broker (trusted)
        |                                    |  web dashboard :8090   <--- you, in a browser
        | bind mounts                        |  unix socket (agent.sock)
        v                                    |
  /host-private/{c,d,x}  (root only, 0700)   |   Herdr (one tab per agent) + ttyd terminal
                                             |
                                             |   claude  codex  agy  grok  opencode  pi  qwen
                                             |   (each its own UID, no root, no capabilities)
                                             |
  state volume  --------------------->  /state  (logins, workspaces, passwords, audit log)
```

There are four ideas to take from this:

1. The agents never touch the drives directly. The drives are mounted inside a folder that only root can open.
2. Agents talk to a broker, which runs as root, through a command called `hostctl`. The broker records the request and waits.
3. You approve or deny each request. You can do that on a web page, or from the Claude session using a one-time code.
4. Everything the agents need to keep (sign-ins, settings, passwords) lives in a Docker volume, so rebuilding the image doesn't make you sign in to everything again.

## A short tour of the ideas underneath

I want this to be readable if you've never run Docker, so here are the pieces I'll keep referring to. Skip any you already know.

### Containers, images, and volumes

An *image* is a frozen recipe-plus-ingredients for a small Linux system: the operating system files, the programs installed on top of it, and the command to run at startup. A *container* is a running copy of an image. It looks like its own computer, with its own file system and its own process list, but it shares the host's kernel. That sharing is why containers start in a second instead of a minute, and it is also why container isolation is weaker than a virtual machine's. A bug in the kernel affects both.

A container's file system is thrown away when the container is removed. A *volume* is storage that Docker keeps separately, so it survives. We'll keep all the important state in one volume. A *bind mount* is a different thing: it makes a folder from the host appear inside the container. We'll use bind mounts to show the Windows drives to the container, and then immediately hide them from the agents.

### Users, UIDs, and file permissions

Linux decides who may read a file by looking at the numeric ID of the user running the program (the UID) and the permission bits on the file. A file with mode `0600` can be read and written by its owner and nobody else. A folder with mode `0700` can only be entered by its owner. Root (UID 0) can ignore these rules.

This is the main trick in the project. If every agent ran as the same user, they could all read each other's files, including each other's login tokens. Instead, each agent gets its own UID (21001 through 21007), and its own home directory, which is private to it. A different agent running as a different UID simply gets "permission denied" when it tries to look inside. And because none of them is root, none of them can open the folder where the Windows drives are mounted.

### Capabilities and `no_new_privs`

Root's power is divided on modern Linux into pieces called *capabilities*, such as "may mount file systems" or "may change file ownership." The launcher that starts each agent drops to the agent's UID, confirms that every capability set is empty, and sets a flag called `no_new_privs`. That flag tells the kernel that this process and anything it starts can never gain privileges, even by running a setuid program. The container itself is also started with `--security-opt no-new-privileges=true`.

### Unix sockets and peer credentials

A *Unix socket* is a file-shaped doorway that two programs on the same machine can use to talk. It has a useful property: when a program connects, the kernel can tell the listener the UID of the connecting process, and the connecting process cannot lie about it. The broker uses this. When a request arrives on the socket, the broker asks the kernel who is on the other end, so an agent can't pretend to be a different agent, and can't claim to be you.

### Namespaces, seccomp, and bubblewrap

We'll spend a whole section on these later, because the container needs a special setting for one of the agents. For now: a *namespace* gives a process its own private view of some part of the system (its own set of mounts, process IDs, network, or user IDs). *Seccomp* is a filter that decides which system calls a process may make. *Bubblewrap* is a small program that uses namespaces to build a sandbox around another program. Codex uses it on Linux.

## What you need before you start

- A Windows machine with WSL2 and an Ubuntu distribution, or a Linux machine. The scripts assume WSL, where your Windows drives appear at `/mnt/c`, `/mnt/d`, and so on.
- Docker, reachable from inside WSL (Docker Desktop with WSL integration turned on, or Docker Engine installed in the distribution). Check with `docker info`.
- Python 3 and `bash` in WSL, plus the `mountpoint` command (part of `util-linux`, normally already there).
- An authenticator app on your phone, such as the one you already use for your accounts. You'll add one entry to it.
- Accounts for whichever agents you plan to use. You don't have to use all seven. Each agent signs in on its own the first time you open it.
- Optionally, an [Open WebUI](https://openwebui.com/) server with an API key, if you want OpenCode, pi, and Qwen Code to use your own models by default.

The project is set up for three drives: C, D, and X. That's what my machine has. If yours has different drives, the places to edit are: the `for drive in c d x` loop and the three `--mount` lines in `run.sh`, the `mkdir` line in the Dockerfile that creates `/host-private/c`, `/d`, and `/x`, and the drive lists in `devbox.py` (search for `'c', 'd', 'x'`). If you only want one drive, make those lists shorter and the startup check will stop insisting on the others. You can also set `"require_mounts": false` in a config override, described later, if you'd rather it not check.

## Building it

Make a folder, and save the files from the appendix at the bottom of this post into it. You need six: `Dockerfile`, `build.sh`, `run.sh`, `attach.sh`, `prepare-seccomp.py`, and `totp_generate.sh`. Then:

```bash
cd ~/herdr-devbox
chmod +x build.sh run.sh attach.sh totp_generate.sh
bash build.sh
```

`build.sh` does three things. First it runs `prepare-seccomp.py`, which creates the seccomp profile file the container will use. I explain what that profile is later; the short version is that it's Docker's standard profile with six extra permissions that bubblewrap needs. The script downloads Docker's upstream profile once and keeps a copy named `default.json` next to itself, so later builds don't need the network for that. If `herdr-seccomp.json` already exists, the script leaves it alone, which means you can hand-edit that file and it won't be overwritten.

Second, `build.sh` runs `docker build`. That installs the operating system packages, Node.js, the seven agents (at pinned versions), Herdr, and the `pi-openai-compat` extension, and then writes the application itself into the image. The application is one Python program, `devbox.py`, embedded in the Dockerfile as a here-document so the whole project stays a single file you can read top to bottom.

Third, it runs the project's self-test inside the freshly built image. The build itself also runs the tests, so a failing test stops you from ending up with a broken image.

The pinned versions are `ARG` lines near the top of the Dockerfile. I pin them because agent CLIs change quickly, and I'd like a rebuild next month to give me the same system. To upgrade one agent, change its version number and rebuild.

## Running it

```bash
bash run.sh
```

`run.sh` is interactive, and it's worth knowing what each prompt means.

**Open WebUI settings.** If you gave it an endpoint before, it shows the saved URL and model (never the key) and asks whether to change them. If you answer yes, or if it's your first run, it asks for the Open WebUI URL and your API key, then fetches the list of models from the server and lets you pick the default by number. That fetch runs in a throwaway container so the key never appears on a command line. If the list can't be fetched, you type the model ID instead. These settings are stored in the state volume, in a folder only root can read.

**Saved passwords.** There are three secrets the project generates: the dashboard password, the OpenCode web password, and the approval (TOTP) secret. After the first run they're saved in the volume. On later runs, `run.sh` asks about each one: `A saved dashboard password exists. Overwrite it? [y/N]`. Answer no and the saved one stays. Answer yes and you can type a new one or press Enter to generate a random one. This is how you keep the same authenticator entry on your phone from run to run, and from build to build.

**Existing container.** If a container with the same name is already running, `run.sh` tells you that recreating it stops anything it's doing, and makes you type the word `recreate` to confirm. Your state volume is not touched.

When it finishes, it prints the approval secret and a URI for your authenticator app, plus the dashboard password and the OpenCode web password. Add the approval secret to your authenticator app as a new entry (most apps accept the base32 string by typing it in, or the `otpauth://` link). If you don't have an app handy, `bash totp_generate.sh` asks for the secret and prints the current code, which is also handy for checking that you entered it correctly.

Open `http://127.0.0.1:8090` in a browser, sign in with the dashboard password, and you'll see the approval page. To get into the terminals, run:

```bash
bash attach.sh
```

That attaches Herdr to the running container. You'll see one workspace per agent. Detach with Ctrl+B, then Q; the container keeps running. You can also reach the very same Herdr session in the browser at `http://127.0.0.1:8090/terminal/`, which is what makes it possible to work from a different computer.

The first time you open each agent's tab, run `agent-login` and follow its sign-in prompts, then `agent-start` to launch it. Claude and Antigravity start with their own remote-control feature on, so once Claude is signed in you can connect to it from the Claude app on your phone. The sign-ins land in each agent's private home inside the volume, so you only do this once.

## The agents, and why each one has its own user

| Agent | UID | How it starts |
|---|---|---|
| claude (the lead) | 21001 | `claude --remote-control` |
| codex | 21002 | `codex`, with approvals on request |
| agy (Antigravity) | 21003 | `agy --remote-control` |
| grok | 21004 | `grok` |
| opencode | 21005 | `opencode attach http://127.0.0.1:4096` |
| pi | 21006 | `pi` |
| qwen | 21007 | `qwen` |

Herdr itself recognizes these agents and shows whether each is idle, working, or waiting for you. That's what makes a tab-per-agent layout manageable. I looked at which of the agents from my own install script Herdr officially supports before adding them. CodeWhale, DeepSeek's `dsh`, and Mistral Vibe aren't on its list, so I left them out, and I chose not to include Gemini CLI, which Herdr only tracks with less testing. If you want those, you can add them by following how `pi` and `qwen` appear in the Dockerfile: a user, a home directory, a launch command, and a login hint.

Claude is the "lead." That role matters in two places: only Claude can relay your approvals from the Claude session, and only Claude can send a task to the other agents. I picked Claude because it's the one I keep a remote-control connection to from my phone. The lead is just a name in a few lists, so you can make a different agent the lead.

None of the launch commands turns off an agent's own safety prompts. I did not use any "yolo" or skip-permissions flag. Pi is an exception only because it has no per-tool approvals at all by design; its protection here comes from running as its own user. One other thing I learned while checking: pi's `-a` flag looks like it might mean "ask for approval," but in pi it means "trust project-local files for this run," which does the opposite of what I wanted. So pi starts with no flags.

All agents run from their own folder, `/state/agents/<name>/workspace`, which is also where each one's private notes and rules files live.

## Protecting the host drives

This is the core of the project, so let's follow one request all the way through.

When the container starts, the Windows drives are bind-mounted at `/host-private/c`, `/host-private/d`, and `/host-private/x`. The parent folder, `/host-private`, is owned by root with mode `0700`. That means only root can even walk into it. No agent is root, so no agent can look at a single file on those drives. This is a plain file permission, not a clever trick, and the self-test checks it by starting a process as each agent's UID and confirming that it gets "permission denied."

An agent that needs a host file runs `hostctl`:

```bash
hostctl list c Users
hostctl read d projects/example.txt
hostctl search x projects "literal text"
hostctl write d projects/example.txt --file ./proposed.txt
```

`hostctl` is a tiny client. It sends a JSON message over the Unix socket to the broker, which is a root-owned part of the same Python program. The broker:

1. Asks the kernel which UID is on the other end, and turns that into an agent name. The message itself can't claim to be someone else.
2. Checks that the drive is one of the allowed ones and that the path is a plain relative path. It refuses `..`, absolute paths, backslashes, colons, control characters, and Windows device names like `CON` and `NUL`.
3. Creates a request record, saves it in memory with a random ID and a timeout (ten minutes by default), writes an entry to a SQLite audit log, and tells the agent the request is pending.

Notice what hasn't happened yet: the broker has not touched the file. Not a read, not a stat. The self-test has a check for this, because it's an easy rule to break accidentally.

The agent's `hostctl` command now waits, polling once a second. When you approve the request, the broker finally does the work. Reading a file opens it without following symbolic links, walks the path one folder at a time with no link-following, and refuses to cross onto a different file system than the drive. A symbolic link is a file that points somewhere else, and an agent that could plant one could try to trick the broker into reading `/etc/passwd`; these precautions are about that attack. The broker also compares the file's identity before and after the read, and rejects the result if the file changed underneath it.

### Writes

A write is the riskiest operation, so it has more care. When you approve a write, the broker:

1. Reads the current version of the file and remembers its identity (inode, size, modification time, hash).
2. Saves the old bytes as a backup in `/state/backups`, named after the request ID.
3. Writes the new content to a temporary file in the same folder and flushes it to disk.
4. Checks the file's identity again. If it changed since step 1, the write is cancelled.
5. Renames the temporary file over the original, and reads it back to confirm it matches what was requested.

The agent never sees the old contents. The web page also has an optional "show diff first" button, which reads the current file and shows you the difference before you decide. A write is one approval, with that diff as an extra step you can use if you want to look.

The rename in step 5 is the best you can do portably, but I should be honest that there is no way to make it perfectly safe against another program editing the same file at the same instant, particularly on Windows drives and network shares. The recheck in step 4 narrows the window; it doesn't close it.

### Limits

By default there are no limits on file size, number of search results, or number of files searched in one request. I wanted large projects to just work. If you'd rather cap them, there are four settings (`max_file_bytes`, `max_entries`, `search_max_files`, `search_max_bytes`), where `0` means unlimited and any positive number is a cap. Keep in mind that "unlimited" means the broker loads a whole file into memory when you approve a read of it.

## Approving requests: two routes

You can approve through either route, and whichever you use first wins. A second decision on the same request gets a "no longer pending" error.

### Route one: the web page

The dashboard shows each pending request with the agent, the operation, the path, and for writes the SHA-256 hash of the proposed content. You press Approve or Deny. The page is protected by a password, and every button carries a token (CSRF protection) so another website can't make your browser press it for you. Sessions last twelve hours.

The dashboard binds to `127.0.0.1` only, so it's reachable from the machine itself and from nowhere else. We'll come back to remote access.

### Route two: from the Claude session

I wanted to approve things from my phone, where I connect to the Claude instance in the container through Claude's remote control, not to the dashboard. That needs a way for approval to happen inside the Claude conversation without an agent being able to approve its own requests.

Here is how it works. The lead agent, Claude, gets four extra `hostctl` commands:

```bash
hostctl pending                 # list what is waiting
hostctl approve ID CODE         # approve one request
hostctl preview ID CODE         # show the diff for a write first (optional)
hostctl deny ID                 # deny, no code needed
```

`CODE` is a six-digit one-time code from your authenticator app. You type it into the conversation, Claude runs the command, and the broker checks the code. Three things stop this from being a hole:

- The broker accepts these commands only from Claude's UID, which it checks through the socket, as before. Any other agent gets a 403 error.
- Each code works exactly once. The broker remembers the last time-slot it accepted, so a code that was used can't be replayed.
- Five wrong codes in a row lock approvals for five minutes.

There is also a second gate in Claude Code itself. The container has a managed settings file at `/etc/claude-code/managed-settings.json`, owned by root so no agent can edit it. It makes Claude Code ask me before running `hostctl approve` or `hostctl preview`. So an approval takes both a tap on my phone and a valid code.

### How the one-time code works

If you've used an authenticator app, you've used TOTP (time-based one-time passwords, [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238)). The app and the broker share a secret, a random string stored in both places. Every thirty seconds, each side independently computes the same six digits from the secret and the current time. Nothing is sent over a network, which is why it works without a connection.

The computation is small enough to show in full. Here it is in Python, as it appears in `totp_generate.sh`:

```python
import base64, hashlib, hmac, struct, time

def code(secret_base32, counter):
    key = base64.b32decode(secret_base32)
    digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff
    return '%06d' % (number % 1000000)

print(code('JBSWY3DPEHPK3PXP', int(time.time() // 30)))   # JBSWY3DPEHPK3PXP is a well-known example secret
```

`int(time.time() // 30)` is the "counter": it increases by one every thirty seconds. The code runs HMAC-SHA1 on that counter using the secret as the key, takes four bytes from a spot chosen by the last byte of the result ("dynamic truncation"), and keeps the last six decimal digits. The broker accepts the code for the previous, current, or next time slot to allow for clocks that are slightly off, and then refuses to ever accept an earlier or equal slot again.

The secret is stored at `/state/secrets/approval-totp`, inside a folder only root can open. That's also why the agents can't read it. `run.sh` prints it on every start so you can always get it again, and you can read it later with `docker exec herdr-devbox cat /state/secrets/approval-totp`.

### The trust model, stated plainly

The code you type into the Claude conversation is visible to Claude. Because it's single-use and expires in about thirty seconds, a leaked code is not much good to anyone, and the Claude Code prompt is a second gate. But this route is weaker than the web page, where the secret never goes near an agent. I use it because being able to approve from my phone is worth that to me. If an agent were truly hostile, the web route is the one that holds up; the phone route holds up against mistakes and against an agent trying to approve its own requests without your knowledge, which are the cases I care about most.

### Telling Claude a request is waiting

Approving from Claude only helps if Claude knows there is something to approve. When a request is created, the broker sends a short message into Claude's terminal pane using Herdr's `agent prompt` command. The message contains only the request ID, which agent asked, the operation, the drive and path (or the search text), and for writes the hash of the content. It never contains file contents or a diff. It also tells Claude what to do: show me the request, ask me for the current code, then run `hostctl approve`.

A few details keep this from becoming a problem. Paths and search text come from agents, so control characters are replaced and long text is cut off before it goes into the message; an agent can't smuggle terminal escape codes or fake instructions into Claude's prompt that way. Messages are batched, so one agent making fifty requests produces one notification rather than fifty. If the notification fails, the request still goes through; the broker logs the error and moves on. And when a request gets decided on the web page, or times out, Claude gets a one-line note so it doesn't ask me about something already closed.

### Not asking twice

Each agent has its own "may I run this command?" prompt, and those would make the whole thing tedious: I'd approve running `hostctl read`, and then approve the read itself. Since the broker is the real gate, I told each agent to run `hostctl list`, `read`, `search`, `write`, and `pending` without asking. The devbox writes that into each agent's own configuration at every start, using whatever mechanism that agent has (Claude's managed settings, Codex's rules files, Qwen's and Antigravity's settings, Grok's config file, and OpenCode's permission block). The commands that relay your decision, `approve`, `preview`, and `deny`, are deliberately left out, so those still ask. The files are merged, not overwritten, so settings you've added yourself survive, and a file that can't be parsed is left alone with a logged warning.

## Agents working together

Claude, as the lead, can also look at and talk to the other agents, using `teamctl`:

```bash
teamctl status                      # which agents are idle, working, or blocked
teamctl prompt codex "write tests for the parser in my workspace"
teamctl read codex                  # last 100 lines of codex's terminal
```

`status` shows names and states only. `prompt` types a task into another agent's terminal, and Claude Code asks me before running it, since the broker doesn't gate it. `read` shows what is on another agent's screen, which could include something sensitive, so it goes through the broker like a file read: it creates a request, and I approve it on the web page or with a code in the Claude session, the same as a host file. Nothing is read until I do.

I should say clearly what this does and doesn't separate. Agents can't read each other's files, but if I ask Claude to relay something one agent saw to another, I've handed it over myself. Approving a read puts that content into the requesting agent's context, and it can mention it to anyone it talks to. The approval step controls new access, not what happens after.

## Bubblewrap, and why the container needs a custom seccomp profile

This is the least obvious part of the project, and the one I had to learn the most to get right.

### What bubblewrap does

[Bubblewrap](https://github.com/containers/bubblewrap) (`bwrap`) is a small command that runs a program inside a sandbox, without needing root. It builds that sandbox out of Linux namespaces. A namespace gives a process a private view of one kind of system resource:

- A *mount namespace* gives it its own set of mounted file systems. Bubblewrap uses this to show a program a tiny made-up file system: perhaps a read-only copy of `/usr`, a scratch `/tmp`, and one writable project folder, and nothing else.
- A *PID namespace* gives it its own process numbering, so it can't see or signal other processes.
- A *network namespace* can cut off network access, or give it a private network.
- A *user namespace* is the clever one. Inside it, a process can appear to be root and have capabilities such as "may mount," but only over things that belong to that namespace. That's how an ordinary user can create the other namespaces without being a real administrator.
- IPC and UTS namespaces isolate shared-memory objects and the hostname.

Codex uses bubblewrap on Linux to sandbox the commands it runs. That's a good thing, since it limits what the model's commands can touch. It also means that Codex needs to be able to create those namespaces inside our container.

### The problem

Docker, by default, applies a *seccomp profile* to every container. Seccomp is a kernel feature that filters the system calls a process may make. Docker's default profile allows most of what normal programs need and blocks a number of calls that create namespaces or mount file systems, unless the container has the `SYS_ADMIN` capability. Those blocks are there because namespaces and mounts have historically been a rich source of kernel bugs, and a container that can create them has more of the kernel exposed to it.

So by default, bubblewrap inside a container fails with an error along the lines of "Creating new namespace failed: Operation not permitted." The usual fixes are to run the container with `--privileged` or add `SYS_ADMIN`, both of which hand the container far more power than I want to give a box full of coding agents.

### The narrower fix

`prepare-seccomp.py` takes Docker's own default profile, keeps all of its rules, and adds exceptions for only the system calls bubblewrap needs:

- `clone` is allowed when the flags don't ask for a new cgroup namespace. The profile checks the first argument against a bit mask.
- `unshare` is allowed only when the flags request some combination of user, mount, PID, network, IPC, and UTS namespaces (plus a System V semaphore flag), and nothing else.
- `mount`, `umount2`, `pivot_root`, and `setns` are allowed outright.

In the script this is a few lines that append rules to the profile's list of syscalls. The interesting ones use `SCMP_CMP_MASKED_EQ`, which compares an argument after masking off some bits:

```python
rules.append({'names': ['clone'], 'action': 'SCMP_ACT_ALLOW',
              'args': [{'index': 0, 'value': 0x02000000, 'valueTwo': 0,
                        'op': 'SCMP_CMP_MASKED_EQ'}]})
```

That reads as: allow `clone` when the cgroup-namespace bit in argument 0 is zero. For `unshare`, the mask is everything except the permitted flags, and the comparison is to zero, so any flag outside the allowed set makes the call fail. I left `clone3`, the newer version of `clone`, at Docker's default. It passes its flags through a pointer, which a seccomp filter can't inspect, so there's no safe way to filter it by flags.

The script also refuses to continue if the upstream profile already contains an explicit deny for one of these calls, because that would mean my assumptions about the profile are wrong and it deserves a human look.

### What you're trading

This does widen the kernel surface exposed to every process in the container, not just Codex. A user namespace inside the container gives processes a kind of local "root" inside their own namespace, and the kernel code that handles that has had bugs. Several other protections still apply: the agents have no real capabilities, the container runs with `no-new-privileges`, and the kernel still checks capability and ownership rules for these calls. But I wouldn't call the result a security certification, and neither does the script; it says to test the profile in a disposable container before pointing it at drives you care about. If you don't use Codex, you can skip the custom profile and run with Docker's default instead, but Codex's bubblewrap sandbox then can't create its namespaces. You can also change how Codex launches with `launch_commands` in the config.

## Open WebUI as the default model provider

I run my own [Open WebUI](https://openwebui.com/) server for open-weight models, and I wanted OpenCode, pi, and Qwen Code all to use it by default without my configuring each one by hand. When `run.sh` has your URL, key, and default model, the devbox writes the right settings into all three at each start:

- OpenCode gets an `openwebui` provider and a default model of `openwebui/<your model>`.
- pi gets the provider through the `pi-openai-compat` extension, and a default provider and model in its settings.
- Qwen Code gets an OpenAI-compatible provider entry, the key in its `env` section, and the default model.

For the URL, you can give the site's address (the devbox appends `/api`), or a URL already ending in `/api` or `/v1` which is used as typed.

Two model-discovery plugins mean you aren't limited to the single model you picked: [opencode-auto-models](https://github.com/BillJr99/opencode-auto-models), which asks the endpoint for its model list and adds all of them, and [pi-openai-compat](https://www.npmjs.com/package/@billjr99/pi-openai-compat) for pi. The pi extension is installed into the image at build time. The OpenCode plugin is added to its configuration as a pinned git commit, and OpenCode downloads it with `git` the first time it starts. That first start needs network access, and the result is cached in the volume after that. The menu in `run.sh` therefore only chooses what each agent starts on. Every model on the server is available from inside the agents.

The part I care about most is that this setup doesn't fight you when you add things. If you add another provider to OpenCode, or log in to something with `/connect`, or add a provider to pi with `/compat-login`, it stays. Each configuration file is merged, not replaced: the devbox sets only the keys it owns (the permission rules, the Open WebUI provider's address and key, and the default model if you haven't chosen another one) and leaves the rest of the file alone. If you set a different default model yourself, the devbox respects that.

## What persists, and where

Everything that matters lives in the Docker volume named `herdr-devbox-state`, mounted at `/state`:

| What | Where |
|---|---|
| Each agent's home: sign-ins, history, config | `/state/agents/<name>/` |
| Approval secret | `/state/secrets/approval-totp` |
| OpenCode web password | `/state/secrets/opencode-password` |
| Dashboard password | `/state/admin-password` |
| Saved Open WebUI settings | `/state/secrets/openwebui.json` |
| Backups of overwritten host files | `/state/backups/` |
| Audit log of every request and decision | `/state/audit.sqlite3` |

The `secrets` folder, and the password files, are readable only by root. The state folder as a whole is set so other users can pass through it but not list it, so each agent can reach its own home and nothing else. This is why rebuilding the image or recreating the container doesn't sign you out of anything. Only `docker volume rm herdr-devbox-state` throws it all away.

The audit log is worth a look now and then. Each row has the time, request ID, agent, operation, drive, path, and what happened to it (requested, approved via web or via the Claude session, denied, expired, failed).

## Configuration

Defaults are in a JSON block inside the Dockerfile. To change them, write a JSON file containing just the keys you want to override, make it owned by root, and point `DEVBOX_CONFIG` at it. The loader refuses keys it doesn't know, which catches typos.

| Key | Default | Meaning |
|---|---|---|
| `max_file_bytes`, `max_entries`, `search_max_files`, `search_max_bytes` | `0` | Limits; `0` is unlimited |
| `approval_timeout_seconds` | `600` | How long a request waits |
| `notify_interval_seconds` | `5` | Minimum gap between messages to Claude |
| `web_port` | `8090` | Dashboard port inside the container |
| `require_mounts` | `true` | Refuse to start unless the drives are mounted |
| `launch_commands` | Codex only | Per-agent launch command overrides |

`run.sh` also reads a few environment variables, including `DEVBOX_IMAGE`, `DEVBOX_CONTAINER`, and `DEVBOX_VOLUME` if you want different names, and `DEVBOX_TOTP_SECRET`, `DEVBOX_ADMIN_PASSWORD`, and `DEVBOX_OPENCODE_PASSWORD` if you'd rather supply the secrets yourself than have them generated. Values given that way replace what's saved, without a prompt. Be aware that anything passed to a container with `-e` can be seen by someone who can run `docker inspect` on the host.

## Reaching it from somewhere else

By default, `run.sh` publishes the dashboard and the OpenCode web port on `127.0.0.1`, which means only the host itself can connect. If you want to reach them from your phone or another computer on a trusted network, set `DEVBOX_BIND` to the address you want, such as your VPN interface's address, before running `run.sh`. On Windows with WSL2, you may also need to open the Windows firewall for the port, and arrange for the traffic to reach WSL. The dashboard is plain HTTP and the `/terminal/` page is a complete shell into the container, so only bind it to something you trust. A safer habit is an SSH tunnel from the other machine:

```bash
ssh -N -L 8090:127.0.0.1:8090 you@your-docker-host
```

Then open `http://localhost:8090` on that machine. For my own use, the Claude remote-control route needs none of this; it works through Anthropic's service, so approving from the phone doesn't require exposing the dashboard.

## Testing

The project has a self-test, `docker run --rm herdr-devbox self-test`, and the build runs it too. About sixty checks cover the things I'd be most upset to get wrong:

- Each agent's UID gets "permission denied" reading the drives, the passwords, and the secrets.
- A request does no file work before approval; denied and expired requests return nothing.
- Path tricks (`..`, absolute paths, colons, backslashes, device names, symbolic links in the middle of a path) are refused.
- Replaying an approval fails. A forged agent name in a message is ignored.
- Writes need an unchanged file, keep a backup, and fail if the file changed.
- The one-time codes: a wrong code is refused, a used code can't be reused, five failures lock approvals, and only the lead can relay.
- Notifications to Claude contain no file contents, strip control characters, batch, and don't break a request if they fail.
- The merged configuration files keep what you added, don't override a default you chose, and leave unparseable files alone.
- The three saved secrets persist, can be replaced, and stay out of the agents' reach.

A couple of those checks need real separate UIDs, so they only run inside the built image (on a plain host, the suite skips them, and the build fails if they get skipped there).

One story from while I was building it: I used HTML comment markers (`<!-- -->`) to fence off the section of each agent's configuration file that the devbox manages. That's fine for the Markdown rules files, but Grok's configuration is a TOML file, where that syntax is an error, and Grok refused to start. The fix was to use `#` comments in TOML files and to remove the old block on the next start. It is a good example of why the self-test now parses every configuration file it generates.

## Limits of this design

Nothing here is perfect isolation, and I'd rather you know where the edges are.

- Containers share the host's kernel. A kernel bug could cross the boundary, and the widened seccomp profile exposes a bit more of the kernel to every process in the container.
- The root broker and controller are trusted. A bug in `devbox.py` is a bug in the security boundary, which is the reason the whole thing is a single file you can read.
- Approving content hands it to the agent. After that, the agent can use it however it likes, including repeating it to other agents.
- The phone route puts a one-time code in front of Claude. It's good against mistakes and unattended approvals, and weaker than the web page against a determined hostile agent.
- Windows drive and network-share behavior (permissions, symbolic links, atomic renames) varies. Test with files you can afford to lose before trusting it with anything else.
- API keys in the Open WebUI integration are stored in the agents' own private configuration files, in the volume. They're protected from other agents, not from someone with access to the Docker host.
- I built this against the agent versions pinned in the Dockerfile. Agent CLIs change quickly, and the configuration formats the devbox writes are the first thing a new release is likely to break.

## When something goes wrong

**`run.sh` says a drive isn't mounted.** The script checks that `/mnt/c`, `/mnt/d`, and `/mnt/x` are real mount points. Run `findmnt -M /mnt/x`. If a drive isn't mounted in WSL, mount it first, or remove that drive from the lists described earlier.

**Bubblewrap or Codex says it can't create a namespace.** Make sure the container started with the custom profile: `docker inspect herdr-devbox` should show the `seccomp=` path to your `herdr-seccomp.json` under the security options.

**An approved read didn't leave a file behind.** `hostctl read` prints the file's bytes to the agent's output. It doesn't copy anything into the workspace. If you want a local copy, redirect the output: `hostctl read d notes.txt > notes.txt`.

**You lost the approval secret.** `docker exec herdr-devbox cat /state/secrets/approval-totp`, or run `run.sh` and say yes to overwriting if you want a new one (then re-add it to your authenticator app).

**OpenCode shows only one model.** The model-discovery plugin is downloaded the first time OpenCode starts, so it needs network access and `git`. Check the OpenCode tab for errors, and restart it after the first start has finished downloading.

**You edited a configuration file and the devbox complained.** Files the devbox merges into must be valid JSON (or TOML for Grok). If one can't be parsed, the devbox leaves it alone and logs a warning, which is safe, but it means its own settings aren't applied to that file until you fix it.

## Where to go from here

The same shape works for other things. The broker pattern (an untrusted client asks, a trusted process checks and waits for a person, then acts) fits any capability you'd like an agent to use but not hold, such as a deploy key or a database connection. The one-time-code idea is also reusable: it's about forty lines, and it lets a person authorize something from a device that has no direct access to the machine.

If you try this, I'd like to hear what breaks. The files follow.

## References

- [Herdr documentation](https://herdr.dev/docs/install/) and its [list of supported agents](https://herdr.dev/docs/agents/)
- [Docker's default seccomp profile](https://docs.docker.com/engine/security/seccomp/) and the [Moby profile source](https://github.com/moby/profiles)
- [Bubblewrap](https://github.com/containers/bubblewrap)
- [Linux namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html) and [user namespaces](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
- [RFC 6238: TOTP](https://www.rfc-editor.org/rfc/rfc6238) and [RFC 4226: HOTP](https://www.rfc-editor.org/rfc/rfc4226)
- [Claude Code remote control](https://code.claude.com/docs/en/remote-control) and [managed settings](https://code.claude.com/docs/en/settings)
- [Codex rules](https://learn.chatgpt.com/docs/agent-configuration/rules)
- [opencode-auto-models](https://github.com/BillJr99/opencode-auto-models) and [pi-openai-compat](https://www.npmjs.com/package/@billjr99/pi-openai-compat)
- [Open WebUI](https://openwebui.com/)

## The files

Save each of these in one folder using the name in its heading. Two other files appear when you build: `default.json` is Docker's upstream seccomp profile, which `prepare-seccomp.py` downloads and keeps, and `herdr-seccomp.json` is the profile it generates from that. Neither needs to be typed in. A few lines in the Dockerfile say "Bill" (in the rules text the agents are given and in the messages to Claude); change those to your name.

### `Dockerfile`

The image and the whole application: the broker, launcher, self-tests, and default configuration are embedded here.

{% raw %}
```dockerfile
# syntax=docker/dockerfile:1.7
# Single-file HerdR devbox, 2026-10-16.
# Authoring checks: payload syntax + 19 portable handler/filesystem tests passed.
# Six real UID/socket integration checks need Docker and run during image build.
# The authoring environment had no Docker daemon; full image and provider logins
# have not been exercised here. Validate WSL/share semantics on your host.
# No local COPY sources, Compose file, privileged mode, or Docker socket required.
#
# BUILD:
#   docker build --pull -t herdr-devbox .
# CHECK (synthetic fixtures only, no host mounts):
#   docker run --rm herdr-devbox self-test
# RUN from WSL, after confirming /mnt/x is the actual network share:
#   findmnt -M /mnt/x
#   docker run -it --name herdr-devbox \
#     --security-opt no-new-privileges=true \
#     --mount type=volume,src=herdr-devbox-state,dst=/state \
#     --mount type=bind,src=/mnt/c,dst=/host-private/c \
#     --mount type=bind,src=/mnt/d,dst=/host-private/d \
#     --mount type=bind,src=/mnt/x,dst=/host-private/x \
#     --add-host=host.docker.internal:host-gateway \
#     -p 127.0.0.1:8090:8090 -p 127.0.0.1:4096:4096 \
#     -e OPENWEBUI_URL=https://YOUR-WEBUI-HOST \
#     -e OPENWEBUI_MODEL=YOUR-EXACT-MODEL-ID \
#     -e OPENWEBUI_API_KEY herdr-devbox
# Set OPENWEBUI_API_KEY in your shell before running; do not put the key here.
# Alternatively use OPENWEBUI_API_KEY_FILE with a read-only secret mounted below
# /host-private/secrets, which remains inaccessible to agents.
# OPENWEBUI_URL may be the WebUI origin, an /api base, or a full chat-completions
# URL. For a custom prefix use its complete API base, ending in /api or /v1.
# All Open WebUI settings are runtime inputs, never build arguments.
#
# Open http://localhost:8090 and use the password printed at startup.
# /terminal/ is a live, authenticated view of this exact HerdR session.
# Native Claude and agy remote control is enabled on interactive launch; complete
# eligible subscription sign-in and workspace trust yourself in each pane.
# Codex's managed remote-control server is enabled after login; pair from the
# Codex shell with: codex remote-control pair
# Grok Build 1.0.62 has no documented native remote-control switch; its exact
# live session is remotely controllable through the common browser terminal.
# Pi and Qwen Code are also supported by HerdR and run under their own UIDs with no yolo
# flags. Pi has no per-tool approval prompts by design (its containment is the UID boundary
# here, plus project-trust prompts: never launch it with -a, which auto-trusts project files).
# Not added: CodeWhale, DeepSeek dsh and Mistral Vibe (not HerdR-supported), Gemini CLI.
# OpenCode uses one authenticated web backend plus an attached HerdR TUI.
# Its username/password are printed at startup; access via localhost:4096.
#
# Close the browser tab to detach. Ctrl+B, Q detaches the local HerdR client;
# in foreground mode detaching stops the container. Use docker run -d instead
# of -it for an always-on browser-only session. Stop with docker stop herdr-devbox.
# Resume an existing stopped container: docker start -ai herdr-devbox
# Attach to a running background instance:
#   docker exec -it herdr-devbox /usr/local/bin/devbox attach
# Retrieve generated UI passwords: docker logs herdr-devbox
# Credentials, local workspaces, backups, audit, and CLI history persist in /state.
# Active jobs end on container stop. Native conversation resume is available in
# each CLI; exact automatic conversation restoration is not claimed.
#
# On another computer, forward the private dashboard through SSH:
#   ssh -N -L 8090:127.0.0.1:8090 USER@DOCKER-HOST
# Then open http://localhost:8090 there. No public web port is needed.
#
# PERMISSIONS:
# Each agent has a distinct UID. /host-private is root-owned 0700, protecting
# mounted drives without changing permissions on Windows files. No agent runs
# as root. The root controller and approval broker are trusted processes.
# hostctl requests list/read/search/write, checking the socket peer's kernel UID.
# Every operation needs a separate human approval; write preview and final write
# are separate decisions. No raw host file descriptor or direct mount is granted.
# This mediates NEW host operations. Already approved content can remain in an
# agent's workspace/model context. Separate identities cannot enforce semantic
# non-disclosure if cooperating agents are deliberately given the same data.
# Broker writes recheck file hashes and preserve the old bytes; there is no
# portable atomic compare-and-swap guarantee against simultaneous host writers.
# DrvFS junctions/SMB durability require validation on your actual WSL/share setup.
# Do not expose separate unauthenticated host filesystem/Docker APIs to agents.
#
# Optional root-owned JSON configuration override: DEVBOX_CONFIG=/path/config.json.
# max_file_bytes, max_entries, search_max_files and search_max_bytes default to 0,
# which means unlimited; set a positive number in the override to restore a cap.
# Runtime knobs and default launch commands are in embedded defaults.json below.
# Agent commands are not allowed to modify broker policy or approve requests.
# Build uses pinned agent releases and verified HerdR/agy payload checksums.
# Base-image tags and Ubuntu security packages remain updateable.

FROM node:24-bookworm-slim AS node_runtime
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive TZ=America/New_York LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git openssh-client locales tzdata \
    python3 python3-aiohttp python3-venv python3-pip \
    util-linux procps ripgrep jq unzip xz-utils ttyd tini \
    libatomic1 libstdc++6 libgcc-s1 build-essential \
    && sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node_runtime /usr/local/ /usr/local/
ARG CLAUDE_VERSION=2.1.302
ARG CODEX_VERSION=0.163.0
ARG GROK_VERSION=1.0.62
ARG OPENCODE_VERSION=1.19.3
ARG PI_VERSION=1.3.0
ARG QWEN_VERSION=0.25.2
# pi-openai-compat publishes on every push to main, so a version is pinned. The opencode plugin
# is pinned by commit in devbox.py (OPENCODE_PLUGIN) and installed by opencode on first start.
ARG PI_OPENAI_COMPAT_VERSION=1.1.35
RUN npm install --global --omit=dev \
    "@anthropic-ai/claude-code@${CLAUDE_VERSION}" \
    "@openai/codex@${CODEX_VERSION}" \
    "@xai-official/grok@${GROK_VERSION}" \
    "opencode-ai@${OPENCODE_VERSION}" \
    && npm cache clean --force
# Pi is installed without lifecycle scripts; Qwen Code needs none either.
RUN npm install --global --omit=dev --ignore-scripts \
    "@earendil-works/pi-coding-agent@${PI_VERSION}" \
    "@qwen-code/qwen-code@${QWEN_VERSION}" \
    && npm cache clean --force
RUN npm install --global --omit=dev --ignore-scripts \
    "@billjr99/pi-openai-compat@${PI_OPENAI_COMPAT_VERSION}" \
    && npm cache clean --force \
    && test -f /usr/local/lib/node_modules/@billjr99/pi-openai-compat/index.ts
RUN install -d -m 0755 /opt/devbox /state /run/devbox \
    && install -d -m 0700 /host-private /host-private/secrets \
    && mkdir /host-private/c /host-private/d /host-private/x \
    && for pair in claude:21001 codex:21002 agy:21003 grok:21004 opencode:21005 pi:21006 qwen:21007; do \
        agent_name="${pair%:*}"; agent_uid="${pair#*:}"; \
        groupadd --gid "$agent_uid" "$agent_name"; \
        useradd --uid "$agent_uid" --gid "$agent_uid" --no-create-home \
          --home-dir "/state/agents/$agent_name" --shell /bin/bash "$agent_name"; \
    done
RUN python3 - <<'INSTALL_NATIVE'
import hashlib, io, json, pathlib, platform, tarfile, traceback, urllib.request
arch = platform.machine()
platforms = {
 'x86_64': {
  'herdr': ('https://github.com/herdrdev/herdr/releases/download/v0.9.5/herdr-linux-x86_64',
            '14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d'),
  'agy': ('https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.0-5281842794987520/linux-x64/cli_linux_x64.tar.gz',
          '6c4b298c2a69b6bd0f58567031cc56d8097a32be54c4b633aa80ad395871b389618ab3860d4ba0a12599831b8226b51b03e258ee2ec7fae105a45b8e0fce2188')},
 'aarch64': {
  'herdr': ('https://github.com/herdrdev/herdr/releases/download/v0.9.5/herdr-linux-aarch64',
            '17d7536f2da50859523680ef279dffcac8e4a235f4e46fe8da6c2ec44141897c'),
  'agy': ('https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.0-5281842794987520/linux-arm/cli_linux_arm64.tar.gz',
          '64dfb2a9665ebd19b6e9d687c094673b61ca9f5ffdebc81391cea8e3858773e1c88154f088e8a8691208561d946a7aea9acbec7a3bdca9e5d8a48fa197b0a308')}
}
if arch not in platforms:
 raise SystemExit('Supported architectures: x86_64 and aarch64')
for name, (url, expected) in platforms[arch].items():
 try:
  for attempt in range(3):
   try:
    req = urllib.request.Request(url, headers={'User-Agent': 'herdr-devbox-build'})
    with urllib.request.urlopen(req, timeout=180) as response:
     payload = response.read()
    break
   except Exception as e:
    print('[download]', e); traceback.print_exc()
    if attempt == 2: raise
  algorithm = 'sha512' if name == 'agy' else 'sha256'
  if hashlib.new(algorithm, payload).hexdigest() != expected:
   raise ValueError(name + ' checksum mismatch')
  if name == 'agy':
   with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    member = archive.getmember('antigravity')
    if not member.isfile(): raise ValueError('Unexpected agy archive member')
    payload = archive.extractfile(member).read()
  path = pathlib.Path('/usr/local/bin') / name
  path.write_bytes(payload); path.chmod(0o755)
 except Exception as e:
  print('[native installation]', e); traceback.print_exc(); raise
INSTALL_NATIVE

COPY <<'DEVBOX_PY' /opt/devbox/devbox.py
#!/usr/bin/python3
"""One-container HerdR workstation. All mutable policy lives in JSON."""
import argparse
import asyncio
import base64
import ctypes
import difflib
import hashlib
import hmac
import html
import http.cookies
import json
import os
import pathlib
import re
import resource
import secrets
import signal
import socket
import sqlite3
import stat
import struct
import subprocess
import sys
import tempfile
import time
import traceback
from aiohttp import web, ClientSession, UnixConnector, WSMsgType

HERE = pathlib.Path(__file__).resolve().parent
AGENTS = {name: 21001 + i for i, name in enumerate(
    ('claude', 'codex', 'agy', 'grok', 'opencode', 'pi', 'qwen'))}
UIDS = {v: k for k, v in AGENTS.items()}
STATE = pathlib.Path(os.environ.get('DEVBOX_STATE', '/state'))
RUN = pathlib.Path(os.environ.get('DEVBOX_RUN', '/run/devbox'))
DRIVES = pathlib.Path(os.environ.get('DEVBOX_DRIVES', '/host-private'))
CFG = {}
CHILDREN = []


def error(where, exc):
    print(f'[{where}] {exc}', file=sys.stderr, flush=True)
    traceback.print_exc()


def load_config():
    cfg = json.loads((HERE / 'defaults.json').read_text())
    # Cached Open WebUI settings live in the root-only secrets directory of the state volume.
    try:
        saved = json.loads((STATE / 'secrets/openwebui.json').read_text())
    except (OSError, ValueError):
        saved = {}
    for key in ('openwebui_url', 'openwebui_model'):
        if saved.get(key):
            cfg[key] = saved[key]
    override = os.environ.get('DEVBOX_CONFIG')
    if override:
        extra = json.loads(pathlib.Path(override).read_text())
        for key, value in extra.items():
            if key not in cfg:
                raise ValueError(f'Unknown configuration key: {key}')
            cfg[key] = value
    envmap = {'OPENWEBUI_URL': 'openwebui_url', 'OPENWEBUI_MODEL': 'openwebui_model',
              'DEVBOX_TOTP_SECRET': 'approval_totp_secret'}
    for env, key in envmap.items():
        if env in os.environ:
            cfg[key] = os.environ[env]
    cfg['openwebui_key'] = os.environ.get('OPENWEBUI_API_KEY') or saved.get('openwebui_key', '')
    keyfile = os.environ.get('OPENWEBUI_API_KEY_FILE')
    if keyfile:
        cfg['openwebui_key'] = pathlib.Path(keyfile).read_text().strip()
    if bool(cfg['openwebui_url']) != bool(cfg['openwebui_model']):
        raise ValueError('Set OPENWEBUI_URL and OPENWEBUI_MODEL together')
    return cfg


def cap(key):
    """Configured numeric limit; 0 means unlimited."""
    return CFG[key] or float('inf')


def client_limit():
    """aiohttp request body cap derived from the file limit (0 = unlimited)."""
    return CFG['max_file_bytes'] * 2 if CFG['max_file_bytes'] else 1 << 62


MANAGED_BEGIN = '<!-- devbox-managed:begin -->'
MANAGED_END = '<!-- devbox-managed:end -->'
TOML_BEGIN = '# devbox-managed:begin'
TOML_END = '# devbox-managed:end'


def write_managed(path, body, uid=0, begin=MANAGED_BEGIN, end_marker=MANAGED_END):
    """Refresh the devbox block between markers; keep user text outside it. Never follows symlinks."""
    block = begin + '\n' + body.rstrip('\n') + '\n' + end_marker + '\n'
    existing = ''
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        pass
    else:
        with os.fdopen(fd, 'r', errors='replace') as f:
            if not stat.S_ISREG(os.fstat(f.fileno()).st_mode):
                raise ValueError(f'Refusing non-regular rules file: {path}')
            existing = f.read()
    start = existing.find(begin)
    end = existing.find(end_marker, start + 1) if start >= 0 else -1
    if start >= 0 and end >= 0:
        tail = existing[end + len(end_marker):].lstrip('\n')
        text = existing[:start] + block + (('\n' + tail) if tail else '')
    elif existing.strip():
        text = block + '\n' + existing  # Pre-marker file: keep its content below the managed block.
    else:
        text = block
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(text)
        os.fchown(f.fileno(), uid, uid)
        os.fchmod(f.fileno(), 0o600)


# hostctl subcommands that only create broker requests; the broker's own approval gates them.
# approve/preview/deny (the human's decision relay) are deliberately not pre-allowed anywhere.
HOSTCTL_FREE = ('list', 'read', 'search', 'write', 'pending')


def write_owned(path, text, uid):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(text)
        os.fchown(f.fileno(), uid, uid)
        os.fchmod(f.fileno(), 0o600)


def read_text_nofollow(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    with os.fdopen(fd, 'r', errors='replace') as f:
        if not stat.S_ISREG(os.fstat(f.fileno()).st_mode):
            raise ValueError(f'Refusing non-regular file: {path}')
        return f.read()


def merge_allow(path, entries, uid):
    """Add entries to permissions.allow in a JSON settings file, keeping everything else."""
    text = read_text_nofollow(path)
    try:
        doc = json.loads(text) if text and text.strip() else {}
        perms = doc.setdefault('permissions', {})
        allow = perms.setdefault('allow', [])
        if not isinstance(doc, dict) or not isinstance(perms, dict) or not isinstance(allow, list):
            raise ValueError('unexpected structure')
    except ValueError as e:
        error('permissions merge skipped for ' + str(path), e)  # Never clobber a file we cannot parse.
        return
    for entry in entries:
        if entry not in allow:
            allow.append(entry)
    write_owned(path, json.dumps(doc, indent=2) + '\n', uid)


def refresh_agent_permissions(name, home, uid):
    """Pre-allow the broker-gated hostctl subcommands in each agent's own permission system."""
    free = HOSTCTL_FREE
    if name == 'codex':
        rules = home / '.codex/rules'
        private_dir(rules, uid)
        write_owned(rules / 'devbox.rules', ''.join(
            'prefix_rule(pattern = ["hostctl", "%s"], decision = "allow", '
            'justification = "Host request gated by the devbox broker")\n' % sub
            for sub in free), uid)
    elif name == 'qwen':
        merge_allow(home / '.qwen/settings.json', ['run_shell_command(hostctl %s)' % sub for sub in free], uid)
    elif name == 'agy':
        directory = home / '.gemini/antigravity-cli'
        private_dir(directory, uid)
        merge_allow(directory / 'settings.json', ['command(hostctl %s)' % sub for sub in free], uid)
    elif name == 'grok':
        body = '[permission]\nrules = [\n' + ''.join(
            '  { action = "allow", tool = "bash", pattern = "hostctl %s *" },\n'
            '  { action = "allow", tool = "bash", pattern = "hostctl %s" },\n' % (sub, sub)
            for sub in free) + ']'
        path = home / '.grok/config.toml'
        existing = read_text_nofollow(path) or ''
        # Earlier builds wrote HTML-comment markers, which are invalid TOML; drop that block.
        legacy = re.sub(re.escape(MANAGED_BEGIN) + '.*?' + re.escape(MANAGED_END) + r'\n?', '', existing, flags=re.S)
        if legacy != existing:
            write_owned(path, legacy, uid)
            existing = legacy
        outside = re.sub(re.escape(TOML_BEGIN) + '.*?' + re.escape(TOML_END), '', existing, flags=re.S)
        if re.search(r'^\s*\[permission\]', outside, re.M):
            error('grok permissions', ValueError('config.toml already has its own [permission] table; '
                                                 'add hostctl allow rules there manually'))
        else:
            write_managed(path, body, uid, TOML_BEGIN, TOML_END)
    # claude: root-owned managed settings (Dockerfile). opencode: generated config below. pi: has no prompts.


# Same spec `opencode plugin github:BillJr99/opencode-auto-models#<commit>` writes to the config
# (opencode 1.19.3 uses the plugin array); opencode fetches it with git on first start.
OPENCODE_PLUGIN = 'github:BillJr99/opencode-auto-models#9950ce159afc9e9ffb4d7ca8752eb6847588e42c'
PI_PLUGIN_DIR = '/usr/local/lib/node_modules/@billjr99/pi-openai-compat'
OPENWEBUI_ENV_KEY = 'OPENWEBUI_API_KEY'


def openwebui_base(url):
    """API base for an Open WebUI origin, /api base, or full chat-completions URL."""
    base = url.rstrip('/')
    if base.endswith('/chat/completions'):
        base = base[:-len('/chat/completions')]
    elif not base.endswith(('/api', '/v1')):
        base += '/api'
    from urllib.parse import urlsplit
    u = urlsplit(base)
    if u.scheme not in ('http', 'https') or not u.hostname or u.username:
        raise ValueError('Open WebUI URL must be an HTTP(S) endpoint without embedded credentials')
    return base


def load_json_object(path):
    """Parsed JSON object (empty if the file is absent), or None if it cannot be safely merged."""
    text = read_text_nofollow(path)
    try:
        doc = json.loads(text) if text and text.strip() else {}
    except ValueError as e:
        error('config merge skipped (fix or remove ' + str(path) + ')', e)
        return None
    if not isinstance(doc, dict):
        error('config merge skipped (' + str(path) + ')', ValueError('top level is not an object'))
        return None
    return doc


def dict_of(value):
    return value if isinstance(value, dict) else {}


def refresh_pi_config(home, uid):
    """Install the pi-openai-compat extension and register Open WebUI as its default provider."""
    agent_dir = home / '.pi/agent'
    private_dir(home / '.pi', uid)
    private_dir(agent_dir, uid)
    settings = load_json_object(agent_dir / 'settings.json')
    if settings is not None:
        packages = settings.get('packages') if isinstance(settings.get('packages'), list) else []
        if PI_PLUGIN_DIR not in packages:
            packages.append(PI_PLUGIN_DIR)
        settings['packages'] = packages
        if CFG['openwebui_url'] and settings.get('defaultProvider') in (None, '', 'compat-openwebui'):
            settings['defaultProvider'] = 'compat-openwebui'
            settings['defaultModel'] = CFG['openwebui_model']
        write_owned(agent_dir / 'settings.json', json.dumps(settings, indent=2) + '\n', uid)
    if not CFG['openwebui_url']:
        return
    private_dir(home / '.config', uid)
    private_dir(home / '.config/pi-openai-compat', uid)
    path = home / '.config/pi-openai-compat/config.json'
    doc = load_json_object(path)
    if doc is None:
        return
    providers = dict_of(doc.get('providers'))
    mine = dict_of(providers.get('openwebui'))
    cached = [m for m in mine.get('cachedModels', []) if isinstance(m, dict) and m.get('id')]
    if CFG['openwebui_model'] not in [m['id'] for m in cached]:
        cached.insert(0, {'id': CFG['openwebui_model']})
    providers['openwebui'] = {**mine, 'displayName': 'Open WebUI', 'baseUrl': openwebui_base(CFG['openwebui_url']),
                              'apiKey': CFG['openwebui_key'] or None, 'cachedModels': cached}
    doc['providers'] = providers
    doc.setdefault('previousModel', None)
    write_owned(path, json.dumps(doc, indent=2) + '\n', uid)


def refresh_qwen_config(home, uid):
    """Register Open WebUI as an OpenAI-compatible provider in Qwen Code and make it the default."""
    if not CFG['openwebui_url']:
        return
    path = home / '.qwen/settings.json'
    doc = load_json_object(path)
    if doc is None:
        return
    base, model = openwebui_base(CFG['openwebui_url']), CFG['openwebui_model']
    env = dict_of(doc.get('env'))
    env[OPENWEBUI_ENV_KEY] = CFG['openwebui_key']
    doc['env'] = env
    providers = dict_of(doc.get('modelProviders'))
    entries = [e for e in providers.get('openai', []) if isinstance(e, dict)]
    ours = [e for e in entries if e.get('envKey') == OPENWEBUI_ENV_KEY]
    for entry in ours:
        entry['baseUrl'] = base
    if model not in [e.get('id') for e in ours]:
        entries.insert(0, {'id': model, 'name': model + ' (Open WebUI)', 'envKey': OPENWEBUI_ENV_KEY, 'baseUrl': base})
    providers['openai'] = entries
    doc['modelProviders'] = providers
    auth = dict_of(dict_of(doc.get('security')).get('auth'))
    chosen = dict_of(doc.get('model')).get('name')
    ours_ids = {e.get('id') for e in entries if e.get('envKey') == OPENWEBUI_ENV_KEY}
    if not auth.get('selectedType') or (auth.get('selectedType') == 'openai' and chosen in (None, '', *ours_ids)):
        doc['security'] = {**dict_of(doc.get('security')), 'auth': {**auth, 'selectedType': 'openai'}}
        doc['model'] = {**dict_of(doc.get('model')), 'name': model}
    write_owned(path, json.dumps(doc, indent=2) + '\n', uid)


def fetch_openwebui_models(url, key):
    """Model IDs reported by GET <base>/models (used by run.sh's default-model picker)."""
    import urllib.request
    req = urllib.request.Request(openwebui_base(url) + '/models',
                                 headers={'Authorization': 'Bearer ' + key, 'User-Agent': 'herdr-devbox'})
    with urllib.request.urlopen(req, timeout=15) as response:
        payload = json.loads(response.read(8 * 1024 * 1024))
    items = payload.get('data', payload) if isinstance(payload, dict) else payload
    return sorted({m['id'] for m in items if isinstance(m, dict) and m.get('id')})


def refresh_opencode_config(path):
    """Merge devbox-owned settings into OpenCode's config without clobbering user additions.

    Owned by the devbox: the permission policy, the Open WebUI provider's endpoint and key, and
    the default model (kept only while it is unset or already an openwebui/ model). Providers,
    models, and every other key you add are preserved; so is anything /connect or /models saves
    elsewhere (auth.json and state live outside this file)."""
    uid = AGENTS['opencode']
    text = read_text_nofollow(path)
    try:
        doc = json.loads(text) if text and text.strip() else {}
        if not isinstance(doc, dict):
            raise ValueError('top level is not an object')
    except ValueError as e:
        error('opencode config merge skipped (fix or remove ' + str(path) + ')', e)
        return
    doc['$schema'] = 'https://opencode.ai/config.json'
    plugins = doc.get('plugin') if isinstance(doc.get('plugin'), list) else []
    plugins = [x for x in plugins if not str(x).startswith('github:BillJr99/opencode-auto-models')]
    plugins.append(OPENCODE_PLUGIN)  # Replaces an older pin of the same plugin.
    doc['plugin'] = plugins
    doc['permission'] = {'*': 'ask', 'bash': {'*': 'ask', **{'hostctl %s*' % sub: 'allow' for sub in HOSTCTL_FREE}}}
    if doc.get('enabled_providers') == ['openwebui']:
        del doc['enabled_providers']  # Legacy devbox allowlist that hid every other provider.
    if CFG['openwebui_url']:
        base = openwebui_base(CFG['openwebui_url'])
        providers = doc.get('provider') if isinstance(doc.get('provider'), dict) else {}
        mine = providers.get('openwebui') if isinstance(providers.get('openwebui'), dict) else {}
        options = mine.get('options') if isinstance(mine.get('options'), dict) else {}
        models = mine.get('models') if isinstance(mine.get('models'), dict) else {}
        models.setdefault(CFG['openwebui_model'], {'name': CFG['openwebui_model']})
        providers['openwebui'] = {**mine, 'npm': '@ai-sdk/openai-compatible', 'name': 'Open WebUI',
                                  'options': {**options, 'baseURL': base, 'apiKey': CFG['openwebui_key']},
                                  'models': models}
        doc['provider'] = providers
        if not doc.get('model') or str(doc['model']).startswith('openwebui/'):
            doc['model'] = 'openwebui/' + CFG['openwebui_model']
    write_owned(path, json.dumps(doc, indent=2) + '\n', uid)


def clean(text, limit=200):
    """Printable, single-line, bounded rendition of untrusted text for notifications."""
    text = re.sub(r'[\x00-\x1f\x7f-\x9f\u2028\u2029]', '?', str(text))
    return text if len(text) <= limit else text[:limit] + '...'


SECRET_SOURCES = {}


def persist_secret(path, explicit_env, regen_env, size):
    """Keep a generated password in the root-only state volume across runs and rebuilds.

    Precedence: an explicit value in explicit_env replaces the saved one; regen_env=1 makes a new
    random one; otherwise the saved value is reused; otherwise one is generated."""
    explicit = os.environ.get(explicit_env, '')
    saved = (read_text_nofollow(path) or '').strip()
    if explicit:
        if len(explicit) < 12 or re.search(r'[\s\x00-\x1f\x7f]', explicit):
            raise ValueError(f'{explicit_env} must be at least 12 characters with no whitespace')
        value, source = explicit, 'configured (replaced any saved password)'
    elif saved and os.environ.get(regen_env) != '1':
        value, source = saved, 'saved from a previous run'
    else:
        value, source = secrets.token_urlsafe(size), 'newly generated'
    if value != saved:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(value)
    SECRET_SOURCES[path.name] = source


def totp_code(secret, counter):
    """RFC 6238 six-digit code (HMAC-SHA1, 30-second step) for a base32 secret."""
    digest = hmac.new(base64.b32decode(secret, casefold=True), struct.pack('>Q', counter), 'sha1').digest()
    offset = digest[-1] & 15
    return '%06d' % ((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000)


def private_dir(path, uid=0):
    path.mkdir(parents=True, exist_ok=True)
    if path.is_symlink() or not path.is_dir():
        raise ValueError(f'Unsafe state directory: {path}')
    os.chown(path, uid, uid)
    path.chmod(0o700)


def write_new(path, content, uid=0, mode=0o600):
    if path.exists() or path.is_symlink():
        return
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'w') as f:
        f.write(content)
        os.fchown(f.fileno(), uid, uid)


def drop_privileges(name):
    """Drop groups, UID, capabilities through UID transition, and future escalation."""
    uid = AGENTS[name]
    if os.geteuid() != 0:
        raise PermissionError('The trusted launcher must start as root')
    for fd in (0, 1, 2):
        if os.isatty(fd):
            os.fchown(fd, uid, uid)
            os.fchmod(fd, 0o600)
    os.setgroups([])
    os.setgid(uid)
    os.setuid(uid)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
        raise OSError(ctypes.get_errno(), 'PR_SET_NO_NEW_PRIVS')
    if libc.prctl(4, 0, 0, 0, 0) != 0:  # PR_SET_DUMPABLE
        raise OSError(ctypes.get_errno(), 'PR_SET_DUMPABLE')
    status = pathlib.Path('/proc/self/status').read_text()
    for field in ('CapEff', 'CapPrm', 'CapAmb'):
        value = re.search(r'^' + field + r':\s*([0-9a-f]+)', status, re.M)
        if value and int(value.group(1), 16):
            raise PermissionError('Agent retained Linux capabilities: ' + field)
    # Only descriptors attached to this agent's terminal may survive exec.
    os.closerange(3, 1048576)
    os.umask(0o077)


def agent_env(name):
    home = STATE / 'agents' / name
    env = {
        'HOME': str(home), 'USER': name, 'LOGNAME': name,
        'PATH': '/usr/local/bin:/usr/bin:/bin', 'SHELL': '/bin/bash',
        'TERM': os.environ.get('TERM', 'xterm-256color'), 'COLORTERM': 'truecolor',
        'LANG': 'en_US.UTF-8', 'LC_ALL': 'en_US.UTF-8', 'TZ': 'America/New_York',
        'BROWSER': '/usr/local/bin/print-browser-url', 'DEVBOX_AGENT': name,
        'DEVBOX_RUN': str(RUN), 'DEVBOX_STATE': str(STATE),
        'XDG_CONFIG_HOME': str(home / '.config'),
        'XDG_CACHE_HOME': str(home / '.cache'),
        'XDG_DATA_HOME': str(home / '.local/share'),
        'HERDR_AGENT': 'antigravity-cli' if name == 'agy' else name,
    }
    # These IDs convey context only. The protected HerdR socket is not inherited.
    for key in ('HERDR_PANE_ID', 'HERDR_WORKSPACE_ID', 'HERDR_TAB_ID', 'HERDR_ENV'):
        if key in os.environ:
            env[key] = os.environ[key]
    if name == 'opencode':
        env['OPENCODE_SERVER_PASSWORD'] = (STATE / 'secrets/opencode-password').read_text().strip()
    return env


def as_agent(name, command):
    env = agent_env(name)
    work = STATE / 'agents' / name / 'workspace'
    os.chdir(work)
    drop_privileges(name)
    os.execvpe(command[0], command, env)


def pane():
    name = os.environ.get('DEVBOX_AGENT', 'claude')
    if name not in AGENTS:
        raise ValueError('Invalid pane agent')
    env = agent_env(name)
    os.chdir(STATE / 'agents' / name / 'workspace')
    drop_privileges(name)
    os.execve('/bin/bash', ['bash', '--rcfile', str(HERE / 'agent.bashrc'), '-i'], env)


def native_start(name):
    commands = {
        'claude': ['claude', '--remote-control'],
        'codex': ['codex'],
        'agy': ['agy', '--remote-control'],
        'grok': ['grok'],
        'opencode': ['opencode', 'attach', 'http://127.0.0.1:4096'],
        'pi': ['pi'],
        'qwen': ['qwen'],
    }
    # Runtime JSON makes command overrides explicit and auditable by the operator.
    cfg = json.loads((STATE / 'public.json').read_text())
    command = cfg['launch_commands'].get(name, commands[name])
    result = subprocess.run(command, check=False)
    print(f'[{name}] Agent exited ({result.returncode}). Use agent-start to reopen it.')
    return result.returncode


def canonical(drive, path):
    if drive not in ('c', 'd', 'x'):
        raise ValueError('Drive must be c, d, or x')
    if not isinstance(path, str) or len(path) > 4096:
        raise ValueError('Invalid path')
    if '\\' in path or ':' in path or '\x00' in path or path.startswith('/'):
        raise ValueError('Use a relative POSIX path without colon or backslash')
    parts = path.split('/') if path not in ('', '.') else []
    if any(p in ('', '.', '..') or p.endswith((' ', '.')) for p in parts):
        raise ValueError('Unsafe path component')
    if any(re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])',
                        p.split('.')[0].upper()) for p in parts):
        raise ValueError('Windows device names are not supported')
    if any(ord(c) < 32 for c in path):
        raise ValueError('Control character in path')
    return parts


def open_dir(drive, parts):
    """Walk beneath an approved drive with no symlink traversal or mount crossings."""
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    fd = os.open(DRIVES / drive, flags)
    device = os.fstat(fd).st_dev
    try:
        for part in parts:
            nextfd = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = nextfd
            if os.fstat(fd).st_dev != device:
                raise PermissionError('Cross-filesystem traversal refused')
        return fd
    except Exception:
        os.close(fd)
        raise


def read_file(drive, path):
    parts = canonical(drive, path)
    if not parts:
        raise ValueError('A file path is required')
    parent = open_dir(drive, parts[:-1])
    fd = None
    try:
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK |
                     os.O_CLOEXEC, dir_fd=parent)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_dev != os.fstat(parent).st_dev:
            raise PermissionError('Only regular files on the selected drive are supported')
        limit = cap('max_file_bytes')
        if before.st_size > limit:
            raise ValueError(f'File exceeds the configured {limit}-byte limit')
        chunks = []
        remaining = limit + 1
        while remaining:
            b = os.read(fd, min(65536, remaining))
            if not b:
                break
            chunks.append(b)
            remaining -= len(b)
        data = b''.join(chunks)
        after = os.fstat(fd)
        stamp = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
        if len(data) > limit or stamp(before) != stamp(after):
            raise ValueError('File changed during read or exceeded the size limit')
        return data, {'sha256': hashlib.sha256(data).hexdigest(),
                      'stamp': list(stamp(after)), 'mode': stat.S_IMODE(after.st_mode),
                      'links': after.st_nlink}
    finally:
        if fd is not None:
            os.close(fd)
        os.close(parent)


def snapshot(drive, path):
    try:
        return read_file(drive, path)
    except FileNotFoundError:
        # The parent must already exist; this does not authorize mkdir.
        parts = canonical(drive, path)
        parent = open_dir(drive, parts[:-1])
        os.close(parent)
        return b'', {'sha256': None, 'stamp': None, 'mode': 0o644, 'links': 0}


def approved_write(request):
    drive, path = request['drive'], request['path']
    expected = request.get('preview_version')
    old, version = snapshot(drive, path)
    if expected is None:
        # One approval covers preview and write: pin the version read right now.
        expected = version
    elif version != expected:
        raise ValueError('File changed after preview; submit a new request')
    if version['links'] > 1:
        raise ValueError('Replacing multiply linked files is refused')
    parts = canonical(drive, path)
    parent = open_dir(drive, parts[:-1])
    temp = '.devbox-' + secrets.token_hex(16)
    data = base64.b64decode(request['content_b64'], validate=True)
    try:
        if version['sha256'] is not None:
            backup = STATE / 'backups' / request['id']
            write_new(backup, base64.b64encode(old).decode())
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     version['mode'], dir_fd=parent)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        # Recheck immediately before replacing the destination. Host-side writers are
        # not locked by this process; ordinary filesystems cannot guarantee CAS here.
        _, current = snapshot(drive, path)
        if current != expected:
            raise ValueError('Concurrent edit detected; replacement refused')
        os.replace(temp, parts[-1], src_dir_fd=parent, dst_dir_fd=parent)
        durability_warning = None
        try:
            os.fsync(parent)
        except OSError as e:
            error('write directory fsync', e)
            durability_warning = str(e)
        actual, _ = read_file(drive, path)
        if actual != data:
            raise IOError('Write verification failed; inspect host file and backup')
        return {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                'backup_id': request['id'] if version['sha256'] else None,
                'durability_warning': durability_warning}
    finally:
        try:
            os.unlink(temp, dir_fd=parent)
        except FileNotFoundError:
            pass
        os.close(parent)


def execute(request):
    op, drive, path = request['op'], request.get('drive'), request.get('path')
    if op == 'read':
        data, version = read_file(drive, path)
        return {'content_b64': base64.b64encode(data).decode(), **version}
    if op == 'list':
        fd = open_dir(drive, canonical(drive, path))
        try:
            result = []
            with os.scandir(fd) as entries:
                for item in entries:
                    if len(result) >= cap('max_entries'):
                        return {'entries': result, 'truncated': True}
                    result.append({'name': item.name,
                                   'directory': item.is_dir(follow_symlinks=False),
                                   'symlink': item.is_symlink()})
            return {'entries': result, 'truncated': False}
        finally:
            os.close(fd)
    if op == 'search':
        # Search is one explicitly bounded operation within the approved subtree.
        needle = request['query']
        queue = [path]
        results, examined, size = [], 0, 0
        while queue and examined < cap('search_max_files'):
            folder = queue.pop()
            fd = open_dir(drive, canonical(drive, folder))
            try:
                with os.scandir(fd) as entries:
                    for entry in entries:
                        examined += 1
                        if examined > cap('search_max_files'):
                            break
                        sub = '/'.join(p for p in (folder if folder != '.' else '', entry.name) if p)
                        if entry.is_symlink():
                            continue
                        if entry.is_dir(follow_symlinks=False):
                            canonical(drive, sub)
                            queue.append(sub)
                        elif entry.is_file(follow_symlinks=False):
                            data, _ = read_file(drive, sub)
                            size += len(data)
                            if size > cap('search_max_bytes'):
                                return {'matches': results, 'truncated': True}
                            for number, line in enumerate(data.decode('utf-8', 'replace').splitlines(), 1):
                                if needle in line:
                                    results.append({'path': sub, 'line': number, 'text': line[:1000]})
                                    if len(results) >= cap('max_entries'):
                                        return {'matches': results, 'truncated': True}
            finally:
                os.close(fd)
        return {'matches': results, 'truncated': bool(queue) or examined >= cap('search_max_files')}
    if op == 'write':
        return approved_write(request)
    if op == 'team-read':
        return {'text': herdr('agent', 'read', PANES[request['target']], '--lines', '100', raw=True)}
    raise ValueError('Unknown operation')


PANES = {}


def herdr(*args, raw=False):
    completed = subprocess.run(herdr_command(*args), check=True, capture_output=True,
                               text=True, timeout=20, env=controller_env())
    if raw:
        return completed.stdout
    parsed = json.loads(completed.stdout)
    if parsed.get('ok') is False or parsed.get('error'):
        raise RuntimeError(parsed)
    return parsed.get('result', parsed)


def herdr_command(*args):
    session = (RUN / 'private/session').read_text().strip()
    return ['herdr', '--session', session, *args]


class Broker:
    def __init__(self):
        self.requests = {}
        self.sessions = {}
        self.lock = asyncio.Lock()
        self.db = sqlite3.connect(STATE / 'audit.sqlite3')
        self.db.execute('CREATE TABLE IF NOT EXISTS audit (time REAL, request_id TEXT, agent TEXT, operation TEXT, drive TEXT, path TEXT, decision TEXT)')
        self.password = (STATE / 'admin-password').read_text().strip()
        # Approval-code secret, kept in the root-only state volume so it survives restarts and
        # rebuilds. Precedence: an explicit secret (DEVBOX_TOTP_SECRET / approval_totp_secret)
        # replaces the saved one; DEVBOX_TOTP_REGENERATE=1 makes a new one; otherwise the saved
        # secret is reused; otherwise a new one is generated.
        saved_path = STATE / 'secrets/approval-totp'
        configured = (CFG.get('approval_totp_secret') or '').replace(' ', '').upper()
        saved = ''
        try:
            saved = (read_text_nofollow(saved_path) or '').strip()
            if saved:
                totp_code(saved, 0)
        except Exception as e:
            error('saved TOTP secret unusable; generating a new one', e)
            saved = ''
        if configured:
            totp_code(configured, 0)  # Fails fast on an invalid base32 secret.
            self.totp_source = 'configured (replaced any saved secret)'
        elif saved and os.environ.get('DEVBOX_TOTP_REGENERATE') != '1':
            configured, self.totp_source = saved, 'saved from a previous run'
        else:
            configured = base64.b32encode(secrets.token_bytes(20)).decode()
            self.totp_source = 'newly generated'
        if configured != saved:
            fd = os.open(saved_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'w') as f:
                f.write(configured)
        self.totp_secret = configured
        self.totp_last = 0
        self.totp_failures = 0
        self.totp_locked_until = 0
        self.notify_queue = []
        self.notify_task = None
        self.notify_last = 0.0

    def notify(self, line):
        """Queue a one-line note for Claude's pane. Batched and rate limited; never raises."""
        try:
            if 'claude' not in PANES:
                return
            self.notify_queue.append(line)
            if self.notify_task is None or self.notify_task.done():
                self.notify_task = asyncio.get_running_loop().create_task(self.flush_notifications())
        except Exception as e:
            error('notify', e)

    async def flush_notifications(self):
        while self.notify_queue:
            wait = self.notify_last + CFG['notify_interval_seconds'] - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            batch, self.notify_queue = self.notify_queue[:6], self.notify_queue[6:]
            more = ('\n...and %d more events; run hostctl pending.' % len(self.notify_queue)
                    if self.notify_queue else '')
            self.notify_queue = []  # Anything beyond one batch is summarized by hostctl pending.
            message = ('[devbox] Host approval activity. Show Bill any new request, ask him for the '
                       'current six-digit authenticator code, then run hostctl approve ID CODE, '
                       'hostctl preview ID CODE, or hostctl deny ID. Do not ask about closed requests.\n' +
                       '\n'.join(batch) + more)
            self.notify_last = time.monotonic()
            try:
                await asyncio.to_thread(herdr, 'agent', 'prompt', PANES['claude'], message)
            except Exception as e:
                error('claude notification', e)

    async def drain_notifications(self):
        while self.notify_task is not None and not self.notify_task.done():
            await asyncio.wait([self.notify_task])

    def request_line(self, r):
        where = ('target ' + clean(r['target'], 40) if 'target' in r else
                 clean(r.get('drive', '')) + ':' + json.dumps(clean(r.get('path', ''))))
        if 'query' in r:
            where += ' query=' + json.dumps(clean(r['query'], 80))
        if 'payload_sha256' in r:
            where += ' sha256=' + r['payload_sha256']
        return 'NEW id=%s agent=%s op=%s %s' % (r['id'], r['agent'], r['op'], where)

    def totp_uri(self):
        return ('otpauth://totp/HerdR%20devbox:approvals?secret=' + self.totp_secret +
                '&issuer=HerdR%20devbox')

    def check_totp(self, code):
        """Single-use authenticator code; five failures lock approvals for five minutes."""
        now = time.time()
        if now < self.totp_locked_until:
            raise web.HTTPTooManyRequests(text='Approval codes are locked after repeated failures')
        counter = int(now // 30)
        matched = None
        for c in (counter - 1, counter, counter + 1):
            if (isinstance(code, str) and re.fullmatch(r'\d{6}', code) and c > self.totp_last
                    and hmac.compare_digest(totp_code(self.totp_secret, c), code)):
                matched = c
        if matched is None:
            self.totp_failures += 1
            if self.totp_failures >= 5:
                self.totp_failures = 0
                self.totp_locked_until = now + 300
            raise web.HTTPForbidden(text='Invalid, expired or reused approval code')
        self.totp_last = matched
        self.totp_failures = 0

    def audit(self, r, decision):
        self.db.execute('INSERT INTO audit VALUES (?,?,?,?,?,?,?)',
                        (time.time(), r['id'], r['agent'], r['op'], r.get('drive'), r.get('path'), decision))
        self.db.commit()

    def peer(self, request):
        sock = request.transport.get_extra_info('socket')
        if not sock or sock.family != socket.AF_UNIX:
            raise web.HTTPForbidden(text='Local agent socket required')
        _, uid, _ = struct.unpack('3i', sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if uid not in UIDS:
            raise web.HTTPForbidden(text='Unknown agent UID')
        return UIDS[uid]

    def expire(self, r):
        if r['status'] == 'pending' and time.time() > r['expires']:
            r['status'] = 'expired'
            self.audit(r, 'expired')
            self.notify('CLOSED id=%s expired' % r['id'])

    async def rpc(self, request):
        agent = self.peer(request)
        data = await request.json()
        action = data.get('action')
        if action == 'get':
            r = self.requests.get(data.get('id'))
            if not r or r['agent'] != agent:
                raise web.HTTPNotFound()
            self.expire(r)
            return web.json_response({k: r[k] for k in ('id', 'status', 'result') if k in r})
        if action in ('pending', 'rc-decide'):
            if agent != 'claude':
                raise web.HTTPForbidden(text='Only the lead may relay approvals')
            if action == 'pending':
                out = []
                for r in self.requests.values():
                    self.expire(r)
                    if r['status'] == 'pending':
                        out.append({k: r[k] for k in ('id', 'agent', 'op', 'drive', 'path', 'query',
                                                      'target', 'payload_sha256', 'diff') if k in r}
                                   | {'preview_authorized': 'preview_version' in r})
                return web.json_response({'pending': out})
            choice = data.get('decision')
            if choice not in ('preview', 'approve', 'deny'):
                raise ValueError('Decision must be preview, approve or deny')
            if choice != 'deny':
                self.check_totp(data.get('code'))
            async with self.lock:
                r = self.requests.get(data.get('id'))
                if not r:
                    raise web.HTTPNotFound()
                self.expire(r)
                if r['status'] != 'pending':
                    raise web.HTTPConflict(text='Request is no longer pending')
                await self.apply_decision(r, choice, 'claude-rc')
                return web.json_response({k: r[k] for k in ('id', 'status', 'result', 'error', 'diff') if k in r})
        if action == 'team-status' or action == 'team-prompt':
            if agent != 'claude':
                raise web.HTTPForbidden(text='Only the lead may coordinate')
            if action == 'team-status':
                listing = herdr('agent', 'list')
                # Only names and state are exposed without a content-transfer approval.
                text = json.dumps(listing)
                return web.json_response({'panes': PANES, 'states':
                    re.findall(r'"(?:state|status)"\s*:\s*"(idle|working|blocked|done|unknown)"', text)})
            target = data.get('target')
            prompt = data.get('prompt', '')
            if target not in PANES or target == 'claude' or not isinstance(prompt, str) or len(prompt) > 12000:
                raise ValueError('Invalid target or prompt')
            # The official agent-prompt interface refuses known blocked approval UIs.
            result = herdr('agent', 'prompt', PANES[target], prompt)
            return web.json_response({'result': result})
        if action != 'create':
            raise ValueError('Unknown action')
        if sum(r['status'] == 'pending' and r['agent'] == agent for r in self.requests.values()) >= 8:
            raise web.HTTPTooManyRequests(text='At most eight pending requests per agent')
        op = data.get('op')
        r = {'id': secrets.token_hex(16), 'agent': agent, 'op': op, 'status': 'pending',
             'expires': time.time() + CFG['approval_timeout_seconds']}
        if op == 'team-read':
            if agent != 'claude' or data.get('target') not in PANES or data['target'] == 'claude':
                raise ValueError('Invalid team-read request')
            r['target'] = data['target']
        else:
            if op not in ('list', 'read', 'write', 'search'):
                raise ValueError('Unsupported host operation')
            canonical(data.get('drive'), data.get('path'))  # No host I/O before approval.
            r.update(drive=data['drive'], path=data['path'])
            if op == 'search':
                if not isinstance(data.get('query'), str) or not 1 <= len(data['query']) <= 200:
                    raise ValueError('Supply a literal search string, 1-200 characters')
                r['query'] = data['query']
            if op == 'write':
                content = base64.b64decode(data['content_b64'], validate=True)
                if len(content) > cap('max_file_bytes'):
                    raise ValueError('Write exceeds configured byte limit')
                r['content_b64'] = base64.b64encode(content).decode()
                r['payload_sha256'] = hashlib.sha256(content).hexdigest()
        self.requests[r['id']] = r
        self.audit(r, 'requested')
        self.notify(self.request_line(r))
        return web.json_response({'id': r['id'], 'status': r['status']})

    def session(self, request):
        sid = request.cookies.get('devbox_session', '')
        found = self.sessions.get(sid)
        if not found or found['expires'] < time.time():
            raise web.HTTPFound('/login')
        return found

    def page(self, body):
        return web.Response(text='<!doctype html><html><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>HerdR devbox</title><style>body{font:16px system-ui;max-width:1000px;'
            'margin:2rem auto;padding:0 1rem;background:#f5f5f1;color:#16221e}'
            'article{background:white;border:1px solid #ccd4cc;padding:1rem;margin:1rem 0}'
            'pre{white-space:pre-wrap;overflow-wrap:anywhere}button{padding:.7rem;margin:.3rem}'
            'input{padding:.7rem}a{color:#075a45}</style>' + body + '</html>',
            content_type='text/html', headers={'Cache-Control': 'no-store',
            'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"})

    async def login(self, request):
        if request.method == 'POST':
            form = await request.post()
            if not secrets.compare_digest(form.get('password', ''), self.password):
                await asyncio.sleep(1)
                raise web.HTTPForbidden(text='Incorrect password')
            sid = secrets.token_urlsafe(32)
            self.sessions[sid] = {'csrf': secrets.token_urlsafe(32), 'expires': time.time() + 43200}
            response = web.HTTPFound('/')
            response.set_cookie('devbox_session', sid, httponly=True, samesite='Strict', max_age=43200)
            return response
        return self.page('<h1>HerdR devbox</h1><p>Use the password printed by docker run.</p>'
            '<form method="post"><input type="password" name="password" required '
            'autocomplete="current-password"><button>Sign in</button></form>')

    async def dashboard(self, request):
        session = self.session(request)
        esc = html.escape
        out = ['<h1>HerdR devbox</h1><p><a href="/terminal/">Open live HerdR terminal</a> · '
               '<a href="/">Refresh requests</a></p><p>Approvals apply once, to the named agent '
               'and exact operation. Reads may enter that agent’s model context. '
               'Searches inspect the displayed subtree within the limits below (0 means unlimited).</p>',
               '<pre>' + esc(json.dumps({k: CFG[k] for k in ('max_file_bytes', 'max_entries',
               'search_max_files', 'search_max_bytes', 'approval_timeout_seconds')}, indent=2)) + '</pre>']
        for r in list(self.requests.values())[-60:][::-1]:
            self.expire(r)
            out.append('<article><h2>' + esc(r['agent'] + ': ' + r['op']) + '</h2><pre>' +
                       esc(json.dumps({k: r[k] for k in ('id', 'drive', 'path', 'query', 'target',
                           'status', 'expires', 'payload_sha256') if k in r}, indent=2)) + '</pre>')
            if r['op'] == 'write':
                if 'diff' in r:
                    out.append('<p>Current content was inspected for this preview. '
                               'Final approval replaces only the previewed version.</p><pre>' + esc(r['diff']) + '</pre>')
                else:
                    content = base64.b64decode(r['content_b64'])
                    out.append('<p>Proposed replacement bytes, UTF-8 preview:</p><pre>' +
                               esc(content.decode('utf-8', 'replace')) + '</pre>')
            if r['status'] == 'pending':
                out.append('<form method="post" action="/decide">'
                    '<input type="hidden" name="csrf" value="' + session['csrf'] + '">'
                    '<input type="hidden" name="id" value="' + r['id'] + '">')
                if r['op'] == 'write' and 'preview_version' not in r:
                    out.append('<button name="decision" value="preview">Show diff against current file first (optional)</button>')
                    out.append('<button name="decision" value="approve">Approve write (reads current file for backup, then replaces it)</button>')
                else:
                    out.append('<button name="decision" value="approve">Approve this operation once</button>')
                out.append('<button name="decision" value="deny">Deny</button></form>')
            if r.get('error'):
                out.append('<pre>' + esc(r['error']) + '</pre>')
            out.append('</article>')
        return self.page(''.join(out))

    async def apply_decision(self, r, choice, channel):
        """Apply one human decision; the caller holds the lock and checked r is pending."""
        try:
            if choice == 'deny':
                r['status'] = 'denied'
                self.audit(r, 'denied via ' + channel)
            elif choice == 'preview' and r['op'] == 'write':
                self.audit(r, 'human-authorized-preview via ' + channel)
                old, version = await asyncio.to_thread(snapshot, r['drive'], r['path'])
                new = base64.b64decode(r['content_b64'])
                diff = ''.join(difflib.unified_diff(old.decode('utf-8', 'replace').splitlines(True),
                    new.decode('utf-8', 'replace').splitlines(True), fromfile='current', tofile='proposed'))
                r['preview_version'] = version
                r['diff'] = diff or '(No text difference; inspect payload hash and byte count.)'
            elif choice == 'approve':
                self.audit(r, 'approved via ' + channel)
                r['status'] = 'executing'  # Consume before any filesystem operation.
                r['result'] = await asyncio.to_thread(execute, dict(r))
                r['status'] = 'completed'
                self.audit(r, 'completed')
            else:
                raise ValueError('Unknown decision')
        except Exception as e:
            error('approved operation', e)
            r['status'] = 'failed'
            r['error'] = str(e)
            r['result'] = {'error': str(e)}
            self.audit(r, 'failed')

    async def decide(self, request):
        session = self.session(request)
        form = await request.post()
        if not secrets.compare_digest(form.get('csrf', ''), session['csrf']):
            raise web.HTTPForbidden(text='Invalid CSRF token')
        async with self.lock:
            r = self.requests.get(form.get('id'))
            if not r:
                raise web.HTTPNotFound()
            self.expire(r)
            if r['status'] != 'pending':
                raise web.HTTPConflict(text='Request is no longer pending')
            await self.apply_decision(r, form.get('decision'), 'web')
            if r['status'] != 'pending':
                self.notify('CLOSED id=%s %s on the web dashboard' % (r['id'], r['status']))
        raise web.HTTPFound('/')

    async def terminal(self, request):
        self.session(request)
        if request.headers.get('Upgrade', '').lower() == 'websocket':
            # A same-site cookie alone does not prevent cross-site WebSocket use.
            origin = request.headers.get('Origin', '')
            if origin != f'{request.scheme}://{request.host}':
                raise web.HTTPForbidden(text='WebSocket origin mismatch')
        connector = UnixConnector(path=str(RUN / 'private/ttyd.sock'))
        async with ClientSession(connector=connector) as client:
            url = 'http://localhost' + str(request.rel_url)
            if request.headers.get('Upgrade', '').lower() != 'websocket':
                async with client.get(url, allow_redirects=False) as upstream:
                    headers = {k: v for k, v in upstream.headers.items()
                               if k.lower() in ('content-type', 'location', 'etag', 'cache-control')}
                    return web.Response(body=await upstream.read(), status=upstream.status, headers=headers)
            protocols = tuple(p.strip() for p in request.headers.get('Sec-WebSocket-Protocol', '').split(',') if p.strip())
            async with client.ws_connect(url, protocols=protocols, max_msg_size=16 * 1024 * 1024) as upstream:
                ws = web.WebSocketResponse(protocols=protocols, max_msg_size=16 * 1024 * 1024)
                await ws.prepare(request)

                async def relay(source, destination):
                    async for msg in source:
                        if msg.type == WSMsgType.BINARY:
                            await destination.send_bytes(msg.data)
                        elif msg.type == WSMsgType.TEXT:
                            await destination.send_str(msg.data)
                        else:
                            break
                    await destination.close()

                tasks = [asyncio.create_task(relay(ws, upstream)), asyncio.create_task(relay(upstream, ws))]
                try:
                    await asyncio.gather(*tasks)
                finally:
                    for task in tasks:
                        task.cancel()
                return ws


@web.middleware
async def errors(request, handler):
    try:
        return await handler(request)
    except web.HTTPException:
        raise
    except Exception as e:
        error('request', e)
        return web.json_response({'error': str(e)}, status=400)


async def run_broker(broker):
    local = web.Application(middlewares=[errors], client_max_size=client_limit())
    local.router.add_post('/rpc', broker.rpc)
    runner = web.AppRunner(local, access_log=None)
    await runner.setup()
    sockpath = RUN / 'agent.sock'
    if sockpath.exists():
        sockpath.unlink()
    await web.UnixSite(runner, str(sockpath)).start()
    sockpath.chmod(0o666)  # Peer UID, not pathname secrecy, authenticates agents.
    app = web.Application(middlewares=[errors], client_max_size=client_limit())
    app.router.add_route('*', '/login', broker.login)
    app.router.add_get('/', broker.dashboard)
    app.router.add_post('/decide', broker.decide)
    app.router.add_get('/terminal/{path:.*}', broker.terminal)
    ui = web.AppRunner(app, access_log=None)
    await ui.setup()
    await web.TCPSite(ui, '0.0.0.0', CFG['web_port']).start()
    return runner, ui


async def call_rpc(data):
    async with ClientSession(connector=UnixConnector(path=str(RUN / 'agent.sock'))) as client:
        async with client.post('http://localhost/rpc', json=data) as response:
            text = await response.text()
            if response.status != 200:
                raise RuntimeError(text)
            return json.loads(text)


async def client_request(args):
    if args.mode == 'team':
        if args.op == 'status':
            print(json.dumps(await call_rpc({'action': 'team-status'}), indent=2))
            return
        if args.op == 'prompt':
            print(json.dumps(await call_rpc({'action': 'team-prompt', 'target': args.target,
                                            'prompt': args.prompt}), indent=2))
            return
        data = {'action': 'create', 'op': 'team-read', 'target': args.target}
    elif args.op in ('pending', 'preview', 'approve', 'deny'):
        # Lead-only relay of the human's decision; approve/preview need a fresh authenticator code.
        if args.op == 'pending':
            payload = {'action': 'pending'}
        else:
            payload = {'action': 'rc-decide', 'id': args.id, 'decision': args.op,
                       'code': getattr(args, 'code', None)}
        print(json.dumps(await call_rpc(payload), indent=2))
        return
    else:
        data = {'action': 'create', 'op': args.op, 'drive': args.drive.lower(), 'path': args.path}
        if args.op == 'write':
            raw = pathlib.Path(args.file).read_bytes()
            data['content_b64'] = base64.b64encode(raw).decode()
        if args.op == 'search':
            data['query'] = args.query
    result = await call_rpc(data)
    print('Awaiting human approval in the devbox dashboard. Request: ' + result['id'], file=sys.stderr)
    while result['status'] in ('pending', 'executing'):
        await asyncio.sleep(1)
        result = await call_rpc({'action': 'get', 'id': result['id']})
    if result['status'] != 'completed':
        raise RuntimeError(json.dumps(result))
    value = result.get('result', {})
    if args.mode == 'host' and args.op == 'read':
        sys.stdout.buffer.write(base64.b64decode(value['content_b64']))
    else:
        print(json.dumps(value, indent=2))


def cli(mode, argv):
    parser = argparse.ArgumentParser(prog='hostctl' if mode == 'host' else 'teamctl')
    sub = parser.add_subparsers(dest='op', required=True)
    if mode == 'host':
        sub.add_parser('pending', help='Claude only: list pending requests')
        for op in ('preview', 'approve', 'deny'):
            p = sub.add_parser(op, help='Claude only: relay the human decision' +
                               ('' if op == 'deny' else ' with the human-typed authenticator code'))
            p.add_argument('id')
            if op != 'deny':
                p.add_argument('code', help='Six-digit code typed by the human; never reuse or guess')
        for op in ('list', 'read', 'search', 'write'):
            p = sub.add_parser(op)
            p.add_argument('drive', choices=('c', 'd', 'x'))
            p.add_argument('path')
            if op == 'search':
                p.add_argument('query')
            if op == 'write':
                p.add_argument('--file', required=True, help='Local file containing proposed replacement bytes')
    else:
        sub.add_parser('status')
        p = sub.add_parser('prompt')
        p.add_argument('target', choices=tuple(n for n in AGENTS if n != 'claude'))
        p.add_argument('prompt')
        p = sub.add_parser('read')
        p.add_argument('target', choices=tuple(n for n in AGENTS if n != 'claude'))
    args = parser.parse_args(argv)
    args.mode = mode
    asyncio.run(client_request(args))


def controller_env():
    return {'HOME': str(STATE / 'controller'), 'PATH': '/usr/local/bin:/usr/bin:/bin',
            'TERM': os.environ.get('TERM', 'xterm-256color'), 'LANG': 'en_US.UTF-8',
            'HERDR_CONFIG_PATH': str(STATE / 'controller/config.toml'),
            'XDG_RUNTIME_DIR': str(RUN / 'private'),
            'DEVBOX_STATE': str(STATE), 'DEVBOX_RUN': str(RUN),
            'DEVBOX_AGENT': 'claude'}


def initialize():
    private_dir(STATE)
    # Other users may reach their own private homes and public configuration only.
    STATE.chmod(0o711)
    private_dir(STATE / 'agents')
    (STATE / 'agents').chmod(0o711)
    for name, uid in AGENTS.items():
        home = STATE / 'agents' / name
        private_dir(home, uid)
        for tail in ('workspace', '.config', '.cache', '.local', '.local/share', '.claude', '.codex', '.grok', '.gemini', '.pi', '.qwen'):
            private_dir(home / tail, uid)
        rules = (
            '# Devbox operating rules\nYou are ' + name + '. Claude is the lead. '
            'Host drives are inaccessible directly. Use hostctl and wait for Bill’s approval.\n'
            'hostctl list c Users\nhostctl read d projects/example.txt\n'
            'hostctl search x project "literal text"\n'
            'hostctl write d projects/example.txt --file ./proposed.txt\n'
            'Every host operation requires its own approval. Never approve a peer’s request. '
            'Claude is notified automatically when a request arrives (a line starting [devbox]). '
            'Only Claude may relay the human\'s decision: run hostctl pending, show Bill the request, '
            'and ask him to type the current six-digit authenticator code; then run hostctl approve ID CODE '
            '(or preview/deny). Never guess, reuse, or invent a code, and never approve on your own initiative. '
            'Agent-private local files may be used without a host request. '
            'Do not share host-derived contents with peers without Bill’s permission.\n'
            'Claude may use teamctl status, teamctl prompt TARGET "task", '
            'and teamctl read TARGET. Reading peer terminal output requires human approval.\n'
            'The common authenticated browser terminal controls these exact live sessions.\n')
        for filename in ('AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'QWEN.md'):
            write_managed(home / 'workspace' / filename, rules, uid)
        write_new(home / '.claude/settings.json', json.dumps({'permissions': {'defaultMode': 'default'}}), uid)
        refresh_agent_permissions(name, home, uid)
    private_dir(STATE / 'controller')
    private_dir(STATE / 'backups')
    private_dir(STATE / 'secrets')
    if CFG['openwebui_url']:
        cache = STATE / 'secrets/openwebui.json'
        if cache.is_symlink():
            raise ValueError('Refusing symlink for cached Open WebUI settings')
        fd = os.open(cache, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump({k: CFG[k] for k in ('openwebui_url', 'openwebui_model', 'openwebui_key')}, f)
    persist_secret(STATE / 'secrets/opencode-password', 'DEVBOX_OPENCODE_PASSWORD', 'DEVBOX_OPENCODE_REGENERATE', 32)
    persist_secret(STATE / 'admin-password', 'DEVBOX_ADMIN_PASSWORD', 'DEVBOX_ADMIN_REGENERATE', 28)
    public = {k: v for k, v in CFG.items() if k not in ('openwebui_key', 'approval_totp_secret')}
    # This generated file is a projection of runtime JSON, not mutable operator settings.
    (STATE / 'public.json').write_text(json.dumps(public, indent=2))
    (STATE / 'public.json').chmod(0o644)
    RUN.mkdir(parents=True, exist_ok=True)
    RUN.chmod(0o755)
    private_dir(RUN / 'private')
    if not DRIVES.is_dir() or DRIVES.is_symlink():
        raise ValueError('Missing protected drive mount parent')
    if DRIVES.stat().st_uid != 0 or stat.S_IMODE(DRIVES.stat().st_mode) != 0o700:
        raise PermissionError('Drive mount parent must be root-owned mode 0700')
    if CFG['require_mounts']:
        for name in ('c', 'd', 'x'):
            if not os.path.ismount(DRIVES / name):
                raise ValueError(f'{name}: is not a mounted drive; startup refused')
    config = ('onboarding = false\n[terminal]\ndefault_shell = "/usr/local/bin/devbox-pane"\n'
              'shell_mode = "non_login"\nnew_cwd = "/state"\n[update]\nversion_check = false\n'
              'manifest_check = false\n[session]\nresume_agents_on_restore = false\n'
              '[ui]\nconfirm_close = true\n[ui.sound]\nenabled = false\n')
    # Reset only generated controller configuration. No user home is mounted here.
    (STATE / 'controller/config.toml').write_text(config.replace('new_cwd = "/state"',
                                                       'new_cwd = ' + json.dumps(str(STATE))))
    home = STATE / 'agents/opencode'
    opath = home / '.config/opencode'
    private_dir(opath, AGENTS['opencode'])
    refresh_opencode_config(opath / 'opencode.json')
    refresh_pi_config(STATE / 'agents/pi', AGENTS['pi'])
    refresh_qwen_config(STATE / 'agents/qwen', AGENTS['qwen'])


def spawn_agent_service(name, command, logfile):
    f = open(logfile, 'ab', buffering=0)
    proc = subprocess.Popen([sys.executable, __file__, 'as-agent', name, *command],
                            stdout=f, stderr=f, env={**controller_env()}, start_new_session=True)
    f.close()
    CHILDREN.append(proc)
    return proc


async def workstation():
    global PANES
    initialize()
    # A fresh generated layout avoids restoring stale privileged controller shells.
    (RUN / 'private/session').write_text('devbox-' + secrets.token_hex(6))
    broker = Broker()
    await run_broker(broker)
    opencode = spawn_agent_service('opencode', ['opencode', 'web', '--hostname', '0.0.0.0',
                                               '--port', '4096'], STATE / 'controller/opencode.log')
    for _ in range(100):
        try:
            reader, writer = await asyncio.open_connection('127.0.0.1', 4096)
            writer.close()
            await writer.wait_closed()
            break
        except OSError:
            if opencode.poll() is not None:
                raise RuntimeError('OpenCode backend exited; inspect controller/opencode.log')
            await asyncio.sleep(.1)
    else:
        raise RuntimeError('OpenCode backend did not become ready')
    log = open(STATE / 'controller/herdr.log', 'ab', buffering=0)
    server = subprocess.Popen(herdr_command('server'), env=controller_env(), stdout=log,
                               stderr=log, start_new_session=True)
    CHILDREN.append(server)
    for _ in range(100):
        try:
            await asyncio.to_thread(herdr, 'workspace', 'list')
            break
        except Exception:
            if server.poll() is not None:
                raise RuntimeError('HerdR server exited; inspect /state/controller/herdr.log')
            await asyncio.sleep(.1)
    else:
        raise RuntimeError('Timed out waiting for HerdR server')
    # Rebuild the generated layout on each container start, without touching agent homes.
    listing = herdr('workspace', 'list')
    existing = listing if isinstance(listing, list) else listing.get('workspaces', [])
    old_ids = [x['workspace_id'] for x in existing]
    for name in AGENTS:
        result = herdr('workspace', 'create', '--cwd', str(STATE), '--label',
                       name + (' (lead)' if name == 'claude' else ''), '--env',
                       'DEVBOX_AGENT=' + name, '--env', 'HERDR_AGENT=' +
                       ('antigravity-cli' if name == 'agy' else name), '--no-focus')
        PANES[name] = result['root_pane']['pane_id']
        if name == 'claude':
            lead_workspace = result['workspace']['workspace_id']
    for workspace_id in old_ids:
        herdr('workspace', 'close', workspace_id)
    herdr('workspace', 'focus', lead_workspace)
    # Native Codex relay uses the account's managed server. Authentication can be
    # completed in the TUI; a bounded retry loop enables it afterward.
    relay_task = asyncio.create_task(codex_relay())
    ttylog = open(STATE / 'controller/ttyd.log', 'ab', buffering=0)
    stale_tty = RUN / 'private/ttyd.sock'
    if stale_tty.exists():
        stale_tty.unlink()
    ttyd = subprocess.Popen(['ttyd', '-W', '-i', str(RUN / 'private/ttyd.sock'),
                             '-b', '/terminal', *herdr_command()], env=controller_env(),
                            stdout=ttylog, stderr=ttylog, start_new_session=True)
    CHILDREN.append(ttyd)
    print(f'\nApproval dashboard and remote HerdR: http://localhost:{CFG["web_port"]}', flush=True)
    print('Dashboard password (%s): %s' % (SECRET_SOURCES.get('admin-password', 'saved'), broker.password), flush=True)
    print('Claude-session approval authenticator secret (%s): %s' % (broker.totp_source, broker.totp_secret), flush=True)
    print('Authenticator URI: ' + broker.totp_uri(), flush=True)
    print('OpenCode web: http://localhost:4096  user: opencode  password (%s): %s' % (
          SECRET_SOURCES.get('opencode-password', 'saved'),
          (STATE / 'secrets/opencode-password').read_text()), flush=True)
    print('Claude/agy native remote control starts in their panes after login. '
          'All seven are also remotely controllable through the protected HerdR web terminal.', flush=True)
    print('First login: complete trust and sign-in in each pane. '
          'agent-login and agent-start are available in every agent shell.', flush=True)
    foreground = None
    if sys.stdin.isatty() and os.environ.get('DEVBOX_HEADLESS') != '1':
        foreground = subprocess.Popen(herdr_command(), env=controller_env())
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    try:
        while not stop.is_set():
            if foreground and foreground.poll() is not None:
                break
            for proc, label in ((server, 'HerdR'), (ttyd, 'ttyd'), (opencode, 'OpenCode')):
                if proc.poll() is not None:
                    raise RuntimeError(label + ' service exited; inspect controller logs')
            try:
                await asyncio.wait_for(stop.wait(), timeout=1)
            except asyncio.TimeoutError:
                pass
    finally:
        relay_task.cancel()
        if foreground and foreground.poll() is None:
            foreground.terminate()
        for proc in reversed(CHILDREN):
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGTERM)
        await asyncio.sleep(.3)


async def codex_relay():
    while True:
        log = STATE / 'controller/codex-remote.log'
        proc = spawn_agent_service('codex', ['codex', 'remote-control', 'start', '--json'], log)
        while proc.poll() is None:
            await asyncio.sleep(2)
        if proc.returncode == 0:
            return
        await asyncio.sleep(30)


def main():
    global CFG
    os.umask(0o077)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'start'
    if mode == 'pane':
        pane()
    elif mode == 'as-agent':
        as_agent(sys.argv[2], sys.argv[3:])
    elif mode == 'agent-start':
        return native_start(os.environ['DEVBOX_AGENT'])
    elif mode in ('host', 'team'):
        cli(mode, sys.argv[2:])
    elif mode == 'self-test':
        import selftest
        return selftest.run()
    elif mode == 'attach':
        os.execvpe('herdr', herdr_command(), controller_env())
    elif mode == 'secret-exists':
        # Used by run.sh: exit 0 if the named saved secret exists. Never prints it.
        path = {'totp': STATE / 'secrets/approval-totp', 'admin': STATE / 'admin-password',
                'opencode': STATE / 'secrets/opencode-password'}[sys.argv[2]]
        return 0 if path.is_file() and path.stat().st_size else 1
    elif mode == 'openwebui-models':
        # Used by run.sh's default-model picker. URL/key come from the environment (just typed)
        # or, when unset, from the cache; the key never appears on a command line.
        try:
            cached = json.loads((STATE / 'secrets/openwebui.json').read_text())
        except (OSError, ValueError):
            cached = {}
        url = os.environ.get('OPENWEBUI_URL') or cached.get('openwebui_url', '')
        key = os.environ.get('OPENWEBUI_API_KEY') or cached.get('openwebui_key', '')
        try:
            print('\n'.join(fetch_openwebui_models(url, key)))
        except Exception as e:
            print('[openwebui-models] ' + str(e), file=sys.stderr)
            return 1
    elif mode == 'openwebui-show':
        # Used by run.sh: prints the cached endpoint (never the key) so you can keep or change it.
        try:
            saved = json.loads((STATE / 'secrets/openwebui.json').read_text())
            print(saved['openwebui_url'])
            print(saved['openwebui_model'])
            print('key' if saved.get('openwebui_key') else 'nokey')
        except (OSError, ValueError, KeyError):
            return 1
    elif mode == 'versions':
        print((HERE / 'versions.txt').read_text())
    elif mode == 'start':
        CFG = load_config()
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        ctypes.CDLL(None).prctl(4, 0, 0, 0, 0)
        asyncio.run(workstation())
    else:
        raise ValueError('Modes: start, attach, self-test, versions')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        error('devbox', e)
        sys.exit(1)


DEVBOX_PY

COPY <<'SELFTEST_PY' /opt/devbox/selftest.py
"""Synthetic security tests. Never mount real drives when running these."""
import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import types
import struct
from unittest.mock import patch
from aiohttp import ClientSession, CookieJar, web
import devbox as d


class SecurityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        if os.geteuid() != 0:
            self.skipTest('UID-boundary tests require container root')
        self.temp = tempfile.TemporaryDirectory(prefix='devbox-selftest-')
        self.root = Path(self.temp.name)
        self.root.chmod(0o755)
        d.STATE, d.RUN, d.DRIVES = [self.root / n for n in ('state', 'run', 'host-private')]
        d.DRIVES.mkdir(mode=0o700)
        for drive in ('c', 'd', 'x'):
            (d.DRIVES / drive).mkdir()
        (d.DRIVES / 'c/secret.txt').write_text('PRIVATE HOST CONTENT\n')
        d.PANES = {}
        d.CFG = d.load_config()
        d.CFG['require_mounts'] = False
        d.CFG['web_port'] = 0
        # Some hosted workspaces map only UID 0. Run filesystem/protocol tests there,
        # but explicitly skip checks that require actual distinct kernel UIDs.
        self.uid_isolation = any(int(line.split()[0]) <= 21007 < int(line.split()[0]) + int(line.split()[2])
                                 for line in Path('/proc/self/uid_map').read_text().splitlines())
        self.old_uids = d.UIDS.copy()
        if self.uid_isolation:
            d.initialize()
        else:
            with patch('os.chown'), patch('os.fchown'):
                d.initialize()
            d.UIDS = {0: 'claude'}
        self.broker = d.Broker()
        self.runners = ()
        self.client = None
        if self.uid_isolation:
            self.runners = await d.run_broker(self.broker)
            site = next(iter(self.runners[1]._sites))
            self.url = 'http://127.0.0.1:' + str(site._server.sockets[0].getsockname()[1])
            self.client = ClientSession(cookie_jar=CookieJar(unsafe=True))
            response = await self.client.post(self.url + '/login', data={'password': self.broker.password}, allow_redirects=False)
            self.assertEqual(response.status, 302)
            response.release()
        else:
            response = await self.broker.login(self.fake_request(method='POST', payload={'password': self.broker.password}))
            self.assertEqual(response.status, 302)
        self.csrf = next(iter(self.broker.sessions.values()))['csrf']

    async def asyncTearDown(self):
        if hasattr(self, 'client'):
            if self.client:
                await self.client.close()
            for runner in self.runners:
                await runner.cleanup()
            self.broker.db.close()
            d.UIDS = self.old_uids
            d.PANES = {}
            self.temp.cleanup()

    async def rpc(self, data, uid=21001):
        # A real process connects after setuid. A supplied JSON agent name has no authority.
        if not self.uid_isolation:
            try:
                response = await self.broker.rpc(self.fake_request(payload=data, uid=0))
                return response.status, json.loads(response.text)
            except web.HTTPException as e:
                return e.status, e.text
            except Exception as e:
                return 400, {'error': str(e)}
        code = '''
import os,socket,sys,json,ctypes
if int(sys.argv[1]) != os.getuid():
 os.setgroups([]);os.setgid(int(sys.argv[1]));os.setuid(int(sys.argv[1]))
ctypes.CDLL(None).prctl(38,1,0,0,0)
s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[2])
b=sys.argv[3].encode()
s.sendall(b'POST /rpc HTTP/1.1\\r\\nHost: local\\r\\nContent-Type: application/json\\r\\nConnection: close\\r\\nContent-Length: '+str(len(b)).encode()+b'\\r\\n\\r\\n'+b)
f=s.makefile('rb');sys.stdout.buffer.write(f.read())
'''
        proc = await asyncio.create_subprocess_exec(sys.executable, '-c', code, str(uid),
            str(d.RUN / 'agent.sock'), json.dumps(data), stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE)
        out, err = await asyncio.wait_for(proc.communicate(), 10)
        self.assertEqual(proc.returncode, 0, err.decode())
        head, body = out.split(b'\r\n\r\n', 1)
        status = int(head.split()[1])
        try:
            return status, json.loads(body)
        except json.JSONDecodeError:
            return status, body.decode()

    async def new(self, op='read', **kw):
        data = {'action': 'create', 'op': op, 'drive': 'c', 'path': 'secret.txt', **kw}
        status, response = await self.rpc(data)
        self.assertEqual(status, 200, response)
        return response['id']

    async def decide(self, rid, decision, csrf=None):
        if not self.uid_isolation:
            try:
                await self.broker.decide(self.fake_request(payload={
                    'csrf': self.csrf if csrf is None else csrf, 'id': rid, 'decision': decision}))
            except web.HTTPException as e:
                return e.status
        response = await self.client.post(self.url + '/decide', data={
            'csrf': self.csrf if csrf is None else csrf, 'id': rid, 'decision': decision},
            allow_redirects=False)
        status = response.status
        await response.read()
        return status

    def fake_request(self, method='GET', payload=None, uid=0, authenticated=True):
        async def value():
            return payload
        sock = types.SimpleNamespace(family=socket.AF_UNIX,
            getsockopt=lambda *args: struct.pack('3i', 1, uid, uid))
        sid = next(iter(self.broker.sessions), '') if authenticated else ''
        return types.SimpleNamespace(method=method, json=value, post=value,
            cookies={'devbox_session': sid}, headers={},
            transport=types.SimpleNamespace(get_extra_info=lambda key: sock))

    def code(self, offset=0):
        return d.totp_code(self.broker.totp_secret, int(time.time() // 30) + offset)

    async def test_rc_approval_requires_valid_single_use_code(self):
        rid = await self.new()
        status, _ = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': '000000'})
        self.assertEqual(status, 403)
        self.assertEqual(self.broker.requests[rid]['status'], 'pending')
        code = self.code()
        status, result = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': code})
        self.assertEqual(status, 200, result)
        self.assertEqual(self.broker.requests[rid]['status'], 'completed')
        rid2 = await self.new()
        status, _ = await self.rpc({'action': 'rc-decide', 'id': rid2, 'decision': 'approve', 'code': code})
        self.assertEqual(status, 403)
        self.assertEqual(self.broker.requests[rid2]['status'], 'pending')

    async def test_rc_lockout_after_failures(self):
        rid = await self.new()
        for _ in range(5):
            await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': '123456'})
        status, _ = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': self.code()})
        self.assertEqual(status, 429)

    async def test_rc_deny_needs_no_code_and_web_conflicts_after(self):
        rid = await self.new()
        status, _ = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'deny'})
        self.assertEqual(status, 200)
        self.assertEqual(await self.decide(rid, 'approve'), 409)

    async def test_rc_pending_lists_requests_and_peer_is_refused(self):
        rid = await self.new()
        status, result = await self.rpc({'action': 'pending'})
        self.assertEqual(status, 200)
        self.assertIn(rid, [x['id'] for x in result['pending']])
        self.assertNotIn('PRIVATE HOST', json.dumps(result))
        if self.uid_isolation:
            status, _ = await self.rpc({'action': 'pending'}, uid=d.AGENTS['codex'])
            self.assertEqual(status, 403)
            status, _ = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'deny'}, uid=d.AGENTS['codex'])
            self.assertEqual(status, 403)

    async def test_openwebui_cache_is_private_and_reused(self):
        cache = d.STATE / 'secrets/openwebui.json'
        self.assertFalse(cache.exists())
        d.CFG.update(openwebui_url='https://w.example.org', openwebui_model='m', openwebui_key='sekrit')
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        self.assertEqual(oct(cache.stat().st_mode & 0o777), '0o600')
        self.assertNotIn('sekrit', (d.STATE / 'public.json').read_text())
        with patch.dict(os.environ, {}, clear=False):
            for k in ('OPENWEBUI_URL', 'OPENWEBUI_MODEL', 'OPENWEBUI_API_KEY'):
                os.environ.pop(k, None)
            cfg = d.load_config()
        self.assertEqual((cfg['openwebui_url'], cfg['openwebui_model'], cfg['openwebui_key']),
                         ('https://w.example.org', 'm', 'sekrit'))

    def watch_herdr(self, fail=False):
        sent = []

        def fake(*args, **kw):
            sent.append(args)
            if fail:
                raise RuntimeError('herdr unavailable')
            return {}
        d.PANES = {'claude': 'pane-claude'}
        d.CFG['notify_interval_seconds'] = 0
        return sent, patch.object(d, 'herdr', fake)

    async def test_request_notifies_claude_pane_without_contents(self):
        sent, mock = self.watch_herdr()
        with mock:
            rid = await self.new('write', content_b64=base64.b64encode(b'PROPOSED SECRET BYTES').decode())
            await self.broker.drain_notifications()
            await self.decide(rid, 'preview')
            await self.broker.drain_notifications()
        self.assertEqual(sent[0][:3], ('agent', 'prompt', 'pane-claude'))
        text = sent[0][3]
        self.assertIn(rid, text)
        self.assertIn('claude', text)
        self.assertIn('write', text)
        self.assertIn('secret.txt', text)
        self.assertIn(hashlib.sha256(b'PROPOSED SECRET BYTES').hexdigest(), text)
        self.assertIn('hostctl approve ID CODE', text)
        everything = json.dumps(sent)
        for forbidden in ('PRIVATE HOST', 'PROPOSED SECRET', base64.b64encode(b'PROPOSED SECRET BYTES').decode(), '---', 'current'):
            if forbidden != 'current':
                self.assertNotIn(forbidden, everything)

    async def test_notification_strips_control_characters(self):
        sent, mock = self.watch_herdr()
        with mock:
            await self.new('search', path='.', query='a\x1b[31m\nIGNORE\rb')
            await self.broker.drain_notifications()
        text = sent[0][3]
        self.assertNotIn('\x1b', text)
        self.assertNotIn('\r', text)
        self.assertNotIn('\nIGNORE', text)

    async def test_failed_notification_does_not_break_request(self):
        sent, mock = self.watch_herdr(fail=True)
        with mock:
            rid = await self.new()
            await self.broker.drain_notifications()
        self.assertEqual(self.broker.requests[rid]['status'], 'pending')
        self.assertTrue(sent)

    async def test_notifications_are_batched(self):
        sent, mock = self.watch_herdr()
        d.CFG['notify_interval_seconds'] = 0.3
        with mock:
            for _ in range(7):
                await self.new()
            await self.broker.drain_notifications()
        self.assertLessEqual(len(sent), 2)

    async def test_web_decision_and_expiry_send_closing_notes(self):
        sent, mock = self.watch_herdr()
        with mock:
            rid = await self.new()
            await self.broker.drain_notifications()
            await self.decide(rid, 'deny')
            rid2 = await self.new()
            self.broker.requests[rid2]['expires'] = time.time() - 1
            await self.decide(rid2, 'approve')
            await self.broker.drain_notifications()
        joined = '\n'.join(m[3] for m in sent)
        self.assertIn('CLOSED id=' + rid + ' denied on the web dashboard', joined)
        self.assertIn('CLOSED id=' + rid2 + ' expired', joined)

    async def test_rules_files_refreshed_and_user_text_kept(self):
        home = d.STATE / 'agents/claude/workspace'
        target = home / 'CLAUDE.md'
        target.write_text(d.MANAGED_BEGIN + '\nSTALE RULES\n' + d.MANAGED_END + '\nMY OWN NOTES\n')
        (home / 'AGENTS.md').write_text('# Devbox operating rules\nold unmarked file\n')
        outside = d.STATE / 'outside.txt'
        outside.write_text('untouched')
        (home / 'QWEN.md').unlink()
        (home / 'QWEN.md').symlink_to(outside)
        with patch('os.chown'), patch('os.fchown'):
            with self.assertRaises(OSError):
                d.initialize()
        self.assertEqual(outside.read_text(), 'untouched')
        (home / 'QWEN.md').unlink()
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        text = target.read_text()
        self.assertNotIn('STALE RULES', text)
        self.assertIn('hostctl approve ID CODE', text)
        self.assertIn('MY OWN NOTES', text)
        self.assertEqual(text.count(d.MANAGED_BEGIN), 1)
        self.assertEqual(oct(target.stat().st_mode & 0o777), '0o600')
        old = (home / 'AGENTS.md').read_text()
        self.assertIn('old unmarked file', old)
        self.assertIn(d.MANAGED_BEGIN, old)

    async def test_hostctl_preallowed_but_decisions_still_prompt(self):
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        agents = d.STATE / 'agents'
        rules = (agents / 'codex/.codex/rules/devbox.rules').read_text()
        self.assertIn('pattern = ["hostctl", "read"]', rules)
        self.assertNotIn('approve', rules)
        qwen = json.loads((agents / 'qwen/.qwen/settings.json').read_text())
        self.assertIn('run_shell_command(hostctl write)', qwen['permissions']['allow'])
        agy = json.loads((agents / 'agy/.gemini/antigravity-cli/settings.json').read_text())
        self.assertIn('command(hostctl search)', agy['permissions']['allow'])
        self.assertNotIn('hostctl approve', json.dumps(agy))
        grok = (agents / 'grok/.grok/config.toml').read_text()
        self.assertIn('pattern = "hostctl read *"', grok)
        self.assertNotIn('approve', grok)
        opencode = json.loads((agents / 'opencode/.config/opencode/opencode.json').read_text())
        self.assertEqual(opencode['permission']['bash']['hostctl read*'], 'allow')
        self.assertEqual(opencode['permission']['bash']['*'], 'ask')

    async def test_permission_merge_preserves_existing_settings_and_is_idempotent(self):
        path = d.STATE / 'agents/qwen/.qwen/settings.json'
        path.write_text(json.dumps({'auth': {'type': 'oauth'}, 'permissions': {'allow': ['run_shell_command(ls)']}}))
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
            d.initialize()
        doc = json.loads(path.read_text())
        self.assertEqual(doc['auth'], {'type': 'oauth'})
        self.assertIn('run_shell_command(ls)', doc['permissions']['allow'])
        self.assertEqual(doc['permissions']['allow'].count('run_shell_command(hostctl read)'), 1)
        path.write_text('{not json')
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        self.assertEqual(path.read_text(), '{not json')

    async def test_grok_config_is_valid_toml_and_legacy_block_repaired(self):
        import tomllib
        path = d.STATE / 'agents/grok/.grok/config.toml'
        path.write_text(d.MANAGED_BEGIN + '\n[permission]\nrules = []\n' + d.MANAGED_END + '\n[ui]\nremember_tool_approvals = true\n')
        for _ in range(2):
            with patch('os.chown'), patch('os.fchown'):
                d.initialize()
            doc = tomllib.loads(path.read_text())
            self.assertEqual(doc['ui'], {'remember_tool_approvals': True})
            rules = doc['permission']['rules']
            self.assertIn({'action': 'allow', 'tool': 'bash', 'pattern': 'hostctl read *'}, rules)
            self.assertNotIn('approve', json.dumps(rules))
            self.assertNotIn('<!--', path.read_text())
            self.assertEqual(path.read_text().count(d.TOML_BEGIN), 1)

    async def test_every_generated_config_parses(self):
        import tomllib
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        for rel in ('grok/.grok/config.toml',):
            tomllib.loads((d.STATE / 'agents' / rel).read_text())
        for rel in ('qwen/.qwen/settings.json', 'agy/.gemini/antigravity-cli/settings.json',
                    'opencode/.config/opencode/opencode.json', 'claude/.claude/settings.json'):
            json.loads((d.STATE / 'agents' / rel).read_text())

    async def test_opencode_config_merges_and_keeps_user_providers(self):
        path = d.STATE / 'agents/opencode/.config/opencode/opencode.json'
        d.CFG.update(openwebui_url='https://w.example.org', openwebui_model='m1', openwebui_key='k1')
        path.write_text(json.dumps({
            'enabled_providers': ['openwebui'], 'model': 'openwebui/old',
            'provider': {'anthropic': {'options': {'apiKey': 'user-key'}},
                         'openwebui': {'models': {'extra': {'name': 'Extra'}}, 'options': {'timeout': 5}}},
            'theme': 'tokyonight', 'permission': 'allow'}))
        for _ in range(2):
            with patch('os.chown'), patch('os.fchown'):
                d.initialize()
            doc = json.loads(path.read_text())
            self.assertNotIn('enabled_providers', doc)
            self.assertEqual(doc['theme'], 'tokyonight')
            self.assertEqual(doc['provider']['anthropic'], {'options': {'apiKey': 'user-key'}})
            self.assertEqual(doc['model'], 'openwebui/m1')  # an openwebui/ default follows the configured model
            ow = doc['provider']['openwebui']
            self.assertEqual(set(ow['models']), {'extra', 'm1'})
            self.assertEqual(ow['options'], {'timeout': 5, 'baseURL': 'https://w.example.org/api', 'apiKey': 'k1'})
            self.assertEqual(doc['permission']['bash']['*'], 'ask')
            self.assertEqual(doc['permission']['*'], 'ask')

    async def test_opencode_default_model_rules(self):
        path = d.STATE / 'agents/opencode/.config/opencode/opencode.json'
        d.CFG.update(openwebui_url='https://w.example.org', openwebui_model='m1', openwebui_key='k1')
        path.unlink(missing_ok=True)
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        self.assertEqual(json.loads(path.read_text())['model'], 'openwebui/m1')
        doc = json.loads(path.read_text())
        doc['model'] = 'anthropic/claude'
        doc['enabled_providers'] = ['anthropic', 'openwebui']
        path.write_text(json.dumps(doc))
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        doc = json.loads(path.read_text())
        self.assertEqual(doc['model'], 'anthropic/claude')
        self.assertEqual(doc['enabled_providers'], ['anthropic', 'openwebui'])

    async def test_opencode_unparseable_config_is_left_alone(self):
        path = d.STATE / 'agents/opencode/.config/opencode/opencode.json'
        path.write_text('// comment\n{"theme": "x"}')
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        self.assertEqual(path.read_text(), '// comment\n{"theme": "x"}')

    def init_with_openwebui(self, url='https://w.example.org', model='m1', key='k1'):
        d.CFG.update(openwebui_url=url, openwebui_model=model, openwebui_key=key)
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()

    async def test_openwebui_base_normalization(self):
        self.assertEqual(d.openwebui_base('https://h'), 'https://h/api')
        self.assertEqual(d.openwebui_base('https://h/api/'), 'https://h/api')
        self.assertEqual(d.openwebui_base('https://h/api/v1'), 'https://h/api/v1')
        self.assertEqual(d.openwebui_base('https://h/api/chat/completions'), 'https://h/api')
        with self.assertRaises(ValueError):
            d.openwebui_base('https://user:pw@h')
        with self.assertRaises(ValueError):
            d.openwebui_base('ftp://h')

    async def test_opencode_plugin_entry_pinned_and_user_plugins_kept(self):
        path = d.STATE / 'agents/opencode/.config/opencode/opencode.json'
        path.write_text(json.dumps({'plugin': ['my-plugin', 'github:BillJr99/opencode-auto-models']}))
        self.init_with_openwebui()
        self.init_with_openwebui()
        plugins = json.loads(path.read_text())['plugin']
        self.assertEqual(plugins, ['my-plugin', d.OPENCODE_PLUGIN])
        self.assertRegex(d.OPENCODE_PLUGIN, r'^github:BillJr99/opencode-auto-models#[0-9a-f]{40}$')

    async def test_pi_configured_for_openwebui_and_user_additions_persist(self):
        home = d.STATE / 'agents/pi'
        (home / '.pi/agent').mkdir(parents=True, exist_ok=True)
        (home / '.pi/agent/settings.json').write_text(json.dumps({'theme': 'dark', 'packages': ['npm:other']}))
        cfg_dir = home / '.config/pi-openai-compat'
        cfg_dir.mkdir(parents=True, exist_ok=True)
        (cfg_dir / 'config.json').write_text(json.dumps({'previousModel': None, 'providers': {
            'openrouter': {'displayName': 'OpenRouter', 'baseUrl': 'https://openrouter.ai/api/v1', 'apiKey': 'or-key',
                           'cachedModels': [{'id': 'x/y'}]},
            'openwebui': {'cachedModels': [{'id': 'discovered', 'contextWindow': 1}]}}}))
        self.init_with_openwebui()
        self.init_with_openwebui(model='m2', key='k2')
        settings = json.loads((home / '.pi/agent/settings.json').read_text())
        self.assertEqual(settings['theme'], 'dark')
        self.assertEqual(settings['packages'], ['npm:other', d.PI_PLUGIN_DIR])
        self.assertEqual((settings['defaultProvider'], settings['defaultModel']), ('compat-openwebui', 'm2'))
        doc = json.loads((cfg_dir / 'config.json').read_text())
        self.assertEqual(doc['providers']['openrouter']['apiKey'], 'or-key')
        ow = doc['providers']['openwebui']
        self.assertEqual((ow['baseUrl'], ow['apiKey']), ('https://w.example.org/api', 'k2'))
        self.assertEqual([m['id'] for m in ow['cachedModels']], ['m2', 'm1', 'discovered'])
        self.assertEqual(ow['cachedModels'][-1]['contextWindow'], 1)

    async def test_pi_default_not_overridden_when_user_chose_another_provider(self):
        home = d.STATE / 'agents/pi'
        (home / '.pi/agent').mkdir(parents=True, exist_ok=True)
        (home / '.pi/agent/settings.json').write_text(json.dumps({'defaultProvider': 'anthropic', 'defaultModel': 'claude'}))
        self.init_with_openwebui()
        settings = json.loads((home / '.pi/agent/settings.json').read_text())
        self.assertEqual((settings['defaultProvider'], settings['defaultModel']), ('anthropic', 'claude'))

    async def test_qwen_configured_for_openwebui_and_user_additions_persist(self):
        path = d.STATE / 'agents/qwen/.qwen/settings.json'
        path.write_text(json.dumps({
            'env': {'OTHER_KEY': 'o'},
            'modelProviders': {'openai': [
                {'id': 'gpt-x', 'name': 'GPT X', 'envKey': 'OTHER_KEY', 'baseUrl': 'https://api.openai.com/v1'},
                {'id': 'extra-ow', 'name': 'Extra', 'envKey': 'OPENWEBUI_API_KEY', 'baseUrl': 'https://old/api'}]},
            'ui': {'theme': 'dark'}}))
        self.init_with_openwebui()
        self.init_with_openwebui(model='m2', key='k2')
        doc = json.loads(path.read_text())
        self.assertEqual(doc['ui'], {'theme': 'dark'})
        self.assertEqual(doc['env'], {'OTHER_KEY': 'o', 'OPENWEBUI_API_KEY': 'k2'})
        entries = {e['id']: e for e in doc['modelProviders']['openai']}
        self.assertEqual(set(entries), {'m1', 'm2', 'gpt-x', 'extra-ow'})  # earlier Open WebUI models are kept
        self.assertEqual(entries['extra-ow']['baseUrl'], 'https://w.example.org/api')
        self.assertEqual(entries['gpt-x']['baseUrl'], 'https://api.openai.com/v1')
        self.assertEqual(entries['m2']['envKey'], 'OPENWEBUI_API_KEY')
        self.assertEqual(doc['security']['auth']['selectedType'], 'openai')
        self.assertEqual(doc['model']['name'], 'm2')
        self.assertIn('run_shell_command(hostctl read)', doc['permissions']['allow'])

    async def test_qwen_user_chosen_auth_and_model_respected(self):
        path = d.STATE / 'agents/qwen/.qwen/settings.json'
        path.write_text(json.dumps({'security': {'auth': {'selectedType': 'qwen-oauth'}}, 'model': {'name': 'coder'}}))
        self.init_with_openwebui()
        doc = json.loads(path.read_text())
        self.assertEqual(doc['security']['auth']['selectedType'], 'qwen-oauth')
        self.assertEqual(doc['model']['name'], 'coder')
        self.assertIn('modelProviders', doc)

    async def test_no_openwebui_means_no_provider_changes(self):
        d.CFG.update(openwebui_url='', openwebui_model='', openwebui_key='')
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        home = d.STATE / 'agents'
        self.assertFalse((home / 'pi/.config/pi-openai-compat/config.json').exists())
        self.assertNotIn('modelProviders', json.loads((home / 'qwen/.qwen/settings.json').read_text()))
        self.assertIn(d.PI_PLUGIN_DIR, json.loads((home / 'pi/.pi/agent/settings.json').read_text())['packages'])

    async def test_fetch_openwebui_models(self):
        import http.server
        import threading
        seen = {}

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                seen['path'], seen['auth'] = self.path, self.headers.get('Authorization')
                body = json.dumps({'data': [{'id': 'b'}, {'id': 'a'}, {'id': 'a'}]}).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass
        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            models = await asyncio.to_thread(d.fetch_openwebui_models, 'http://127.0.0.1:%d' % server.server_port, 'sekret')
        finally:
            server.shutdown()
        self.assertEqual(models, ['a', 'b'])
        self.assertEqual((seen['path'], seen['auth']), ('/api/models', 'Bearer sekret'))

    async def test_grok_existing_permission_table_is_not_clobbered(self):
        path = d.STATE / 'agents/grok/.grok/config.toml'
        path.write_text('[permission]\nrules = []\n')
        with patch('os.chown'), patch('os.fchown'):
            d.initialize()
        self.assertEqual(path.read_text(), '[permission]\nrules = []\n')

    async def test_team_read_approved_through_claude_session(self):
        calls = []

        def fake(*args, **kw):
            calls.append(args)
            return 'PEER TERMINAL TEXT' if args[:2] == ('agent', 'read') else {}
        d.PANES = {'claude': 'pane-claude', 'codex': 'pane-codex'}
        d.CFG['notify_interval_seconds'] = 0
        with patch.object(d, 'herdr', fake):
            status, created = await self.rpc({'action': 'create', 'op': 'team-read', 'target': 'codex'})
            self.assertEqual(status, 200, created)
            rid = created['id']
            await self.broker.drain_notifications()
            prompts = [c for c in calls if c[:2] == ('agent', 'prompt')]
            self.assertIn('target codex', prompts[0][3])
            self.assertNotIn('PEER TERMINAL TEXT', prompts[0][3])
            # Nothing is read before approval, and the pending list shows the target only.
            self.assertFalse([c for c in calls if c[:2] == ('agent', 'read')])
            status, listing = await self.rpc({'action': 'pending'})
            entry = next(x for x in listing['pending'] if x['id'] == rid)
            self.assertEqual((entry['op'], entry['target']), ('team-read', 'codex'))
            self.assertNotIn('PEER TERMINAL TEXT', json.dumps(listing))
            # A wrong code reads nothing; a valid single-use code returns the peer text once.
            status, _ = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': '000000'})
            self.assertEqual(status, 403)
            self.assertFalse([c for c in calls if c[:2] == ('agent', 'read')])
            code = self.code()
            status, result = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': code})
            self.assertEqual(status, 200, result)
            self.assertEqual(result['status'], 'completed')
            self.assertEqual(result['result']['text'], 'PEER TERMINAL TEXT')
            reads = [c for c in calls if c[:2] == ('agent', 'read')]
            self.assertEqual(len(reads), 1)
            self.assertEqual(reads[0][2], 'pane-codex')
            status, again = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': code})
            self.assertIn(status, (403, 409))
            self.assertEqual(len([c for c in calls if c[:2] == ('agent', 'read')]), 1)
        self.assertIn('claude-rc', [row[0].split(' via ')[-1] for row in self.broker.db.execute(
            "SELECT decision FROM audit WHERE request_id=? AND decision LIKE 'approved via%'", (rid,))])

    async def test_team_read_rules(self):
        d.PANES = {'claude': 'pane-claude', 'codex': 'pane-codex'}
        for target in ('claude', 'nobody', None):
            status, _ = await self.rpc({'action': 'create', 'op': 'team-read', 'target': target})
            self.assertEqual(status, 400, target)
        if self.uid_isolation:
            status, _ = await self.rpc({'action': 'create', 'op': 'team-read', 'target': 'claude'},
                                       uid=d.AGENTS['codex'])
            self.assertEqual(status, 400)
            status, created = await self.rpc({'action': 'create', 'op': 'team-read', 'target': 'codex'})
            self.assertEqual(status, 200)
            status, _ = await self.rpc({'action': 'rc-decide', 'id': created['id'], 'decision': 'deny'},
                                       uid=d.AGENTS['codex'])
            self.assertEqual(status, 403)

    async def test_totp_secret_persists_and_precedence(self):
        path = d.STATE / 'secrets/approval-totp'
        first = path.read_text()
        self.assertEqual(oct(path.stat().st_mode & 0o777), '0o600')
        self.assertEqual(oct(path.parent.stat().st_mode & 0o777), '0o700')
        self.assertEqual(self.broker.totp_source, 'newly generated')
        self.assertEqual(d.Broker().totp_secret, first)            # reused across runs
        self.assertEqual(d.Broker().totp_source, 'saved from a previous run')
        with patch.dict(os.environ, {'DEVBOX_TOTP_REGENERATE': '1'}):
            regenerated = d.Broker()
        self.assertNotEqual(regenerated.totp_secret, first)
        self.assertEqual(path.read_text(), regenerated.totp_secret)
        d.CFG['approval_totp_secret'] = 'jbsw y3dp ehpk 3pxp'      # spaces/case tolerated
        explicit = d.Broker()
        self.assertEqual(explicit.totp_secret, 'JBSWY3DPEHPK3PXP')
        self.assertEqual(path.read_text(), 'JBSWY3DPEHPK3PXP')
        d.CFG['approval_totp_secret'] = ''
        self.assertEqual(d.Broker().totp_secret, 'JBSWY3DPEHPK3PXP')  # explicit value now saved
        path.write_text('not base32 !!')
        self.assertNotEqual(d.Broker().totp_secret, 'not base32 !!')

    async def test_passwords_persist_across_runs_and_can_be_replaced(self):
        for name, path, explicit, regen in (
                ('admin', d.STATE / 'admin-password', 'DEVBOX_ADMIN_PASSWORD', 'DEVBOX_ADMIN_REGENERATE'),
                ('opencode', d.STATE / 'secrets/opencode-password', 'DEVBOX_OPENCODE_PASSWORD',
                 'DEVBOX_OPENCODE_REGENERATE')):
            first = path.read_text()
            self.assertEqual(oct(path.stat().st_mode & 0o777), '0o600', name)
            with patch('os.chown'), patch('os.fchown'):
                d.initialize()
            self.assertEqual(path.read_text(), first, name)
            self.assertEqual(d.SECRET_SOURCES[path.name], 'saved from a previous run')
            with patch.dict(os.environ, {regen: '1'}), patch('os.chown'), patch('os.fchown'):
                d.initialize()
            self.assertNotEqual(path.read_text(), first, name)
            self.assertEqual(d.SECRET_SOURCES[path.name], 'newly generated')
            with patch.dict(os.environ, {explicit: 'my-own-password-123'}), patch('os.chown'), patch('os.fchown'):
                d.initialize()
            self.assertEqual(path.read_text(), 'my-own-password-123', name)
            with patch.dict(os.environ, {explicit: 'short'}), patch('os.chown'), patch('os.fchown'):
                with self.assertRaises(ValueError):
                    d.initialize()
            with patch('os.chown'), patch('os.fchown'):
                d.initialize()
            self.assertEqual(path.read_text(), 'my-own-password-123', name)  # explicit value is now the saved one

    async def test_opencode_password_reaches_only_the_opencode_agent_env(self):
        (d.STATE / 'secrets/opencode-password').write_text('pw-for-opencode-xyz')
        self.assertEqual(d.agent_env('opencode')['OPENCODE_SERVER_PASSWORD'], 'pw-for-opencode-xyz')
        self.assertNotIn('OPENCODE_SERVER_PASSWORD', d.agent_env('codex'))

    async def test_totp_secret_unreadable_by_agents(self):
        if not self.uid_isolation:
            self.skipTest('Distinct UIDs unavailable in this host workspace')
        code = 'import os,sys;os.setgroups([]);os.setgid(21001);os.setuid(21001);open(sys.argv[1]).read()'
        proc = await asyncio.create_subprocess_exec(sys.executable, '-c', code,
            str(d.STATE / 'secrets/approval-totp'), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await proc.communicate()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn(b'PermissionError', err)

    async def test_totp_secret_is_not_in_public_config(self):
        self.assertNotIn(self.broker.totp_secret, (d.STATE / 'public.json').read_text())

    async def test_totp_matches_rfc6238_vector(self):
        import base64 as b
        secret = b.b32encode(b'12345678901234567890').decode()
        self.assertEqual(d.totp_code(secret, 59 // 30), '287082')

    async def test_all_agent_uids_cannot_read_directly(self):
        if not self.uid_isolation:
            self.skipTest('Host maps only UID 0; run this check inside the built image')
        for name, uid in d.AGENTS.items():
            code = 'import os,sys;os.setgroups([]);os.setgid(int(sys.argv[1]));os.setuid(int(sys.argv[1]));open(sys.argv[2]).read()'
            proc = await asyncio.create_subprocess_exec(sys.executable, '-c', code, str(uid),
                str(d.DRIVES / 'c/secret.txt'), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            _, err = await proc.communicate()
            self.assertNotEqual(proc.returncode, 0, name)
            self.assertIn(b'PermissionError', err)

    async def test_pending_read_has_no_host_contents(self):
        rid = await self.new()
        status, result = await self.rpc({'action': 'get', 'id': rid})
        self.assertEqual(status, 200)
        self.assertEqual(result['status'], 'pending')
        self.assertNotIn('result', result)
        self.assertNotIn('PRIVATE HOST', json.dumps(self.broker.requests[rid]))

    async def test_no_file_io_before_approval(self):
        rid = await self.new(path='does-not-exist.txt')
        self.assertEqual(self.broker.requests[rid]['status'], 'pending')

    async def test_approval_returns_exact_bytes(self):
        rid = await self.new()
        self.assertEqual(await self.decide(rid, 'approve'), 302)
        status, result = await self.rpc({'action': 'get', 'id': rid})
        self.assertEqual(status, 200)
        self.assertEqual(base64.b64decode(result['result']['content_b64']), b'PRIVATE HOST CONTENT\n')

    async def test_denial_returns_no_contents(self):
        rid = await self.new()
        await self.decide(rid, 'deny')
        _, result = await self.rpc({'action': 'get', 'id': rid})
        self.assertEqual(result['status'], 'denied')
        self.assertNotIn('result', result)

    async def test_uid_spoofing_ignored(self):
        rid = await self.new(agent='codex', uid=0)
        self.assertEqual(self.broker.requests[rid]['agent'], 'claude')

    async def test_peer_cannot_collect_approved_read(self):
        if not self.uid_isolation:
            self.skipTest('Distinct UIDs unavailable in this host workspace')
        rid = await self.new()
        await self.decide(rid, 'approve')
        status, _ = await self.rpc({'action': 'get', 'id': rid}, uid=d.AGENTS['codex'])
        self.assertEqual(status, 404)

    async def test_root_is_not_an_agent(self):
        if not self.uid_isolation:
            self.skipTest('Distinct UIDs unavailable in this host workspace')
        status, _ = await self.rpc({'action': 'create', 'op': 'read', 'drive': 'c', 'path': 'secret.txt'}, uid=0)
        self.assertEqual(status, 403)

    async def test_traversal_rejected(self):
        for path in ('../admin-password', '/etc/passwd', 'a/../b', 'a\\b', 'foo:stream', 'a//b', 'a./b'):
            with self.assertRaises(ValueError):
                d.canonical('c', path)

    async def test_symlink_rejected_after_approval(self):
        (d.DRIVES / 'c/link').symlink_to('/etc/passwd')
        rid = await self.new(path='link')
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['status'], 'failed')

    async def test_intermediate_symlink_rejected(self):
        (d.DRIVES / 'c/link').symlink_to('/etc', target_is_directory=True)
        rid = await self.new(path='link/passwd')
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['status'], 'failed')

    async def test_csrf_rejected(self):
        rid = await self.new()
        self.assertEqual(await self.decide(rid, 'approve', csrf='invalid'), 403)
        self.assertEqual(self.broker.requests[rid]['status'], 'pending')

    async def test_unauthenticated_ui_redirects(self):
        if not self.uid_isolation:
            for method in (self.broker.dashboard, self.broker.terminal):
                with self.assertRaises(web.HTTPFound):
                    await method(self.fake_request(authenticated=False))
            return
        async with ClientSession() as client:
            async with client.get(self.url + '/', allow_redirects=False) as response:
                self.assertEqual(response.status, 302)
            async with client.get(self.url + '/terminal/', allow_redirects=False) as response:
                self.assertEqual(response.status, 302)

    async def test_replay_rejected(self):
        rid = await self.new()
        await self.decide(rid, 'approve')
        self.assertEqual(await self.decide(rid, 'approve'), 409)

    async def test_expiry(self):
        rid = await self.new()
        self.broker.requests[rid]['expires'] = time.time() - 1
        self.assertEqual(await self.decide(rid, 'approve'), 409)
        self.assertEqual(self.broker.requests[rid]['status'], 'expired')

    async def test_write_single_approval_backs_up_and_writes(self):
        rid = await self.new('write', content_b64=base64.b64encode(b'new\n').decode())
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['status'], 'completed')
        self.assertEqual((d.DRIVES / 'c/secret.txt').read_text(), 'new\n')
        self.assertEqual(base64.b64decode((d.STATE / 'backups' / rid).read_text()), b'PRIVATE HOST CONTENT\n')
        self.assertNotIn('PRIVATE HOST', json.dumps((await self.rpc({'action': 'get', 'id': rid}))[1]))

    async def test_rc_write_needs_only_one_code(self):
        rid = await self.new('write', content_b64=base64.b64encode(b'new\n').decode())
        status, result = await self.rpc({'action': 'rc-decide', 'id': rid, 'decision': 'approve', 'code': self.code()})
        self.assertEqual(status, 200, result)
        self.assertEqual((d.DRIVES / 'c/secret.txt').read_text(), 'new\n')

    async def test_preview_does_not_disclose_old_file_to_agent(self):
        rid = await self.new('write', content_b64=base64.b64encode(b'new\n').decode())
        await self.decide(rid, 'preview')
        _, result = await self.rpc({'action': 'get', 'id': rid})
        self.assertEqual(result['status'], 'pending')
        self.assertNotIn('PRIVATE HOST', json.dumps(result))

    async def test_approved_write_and_backup(self):
        rid = await self.new('write', content_b64=base64.b64encode(b'new\n').decode())
        await self.decide(rid, 'preview')
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['status'], 'completed')
        self.assertEqual((d.DRIVES / 'c/secret.txt').read_text(), 'new\n')
        self.assertEqual(base64.b64decode((d.STATE / 'backups' / rid).read_text()), b'PRIVATE HOST CONTENT\n')

    async def test_stale_write_rejected(self):
        rid = await self.new('write', content_b64=base64.b64encode(b'new\n').decode())
        await self.decide(rid, 'preview')
        (d.DRIVES / 'c/secret.txt').write_text('concurrent change\n')
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['status'], 'failed')
        self.assertEqual((d.DRIVES / 'c/secret.txt').read_text(), 'concurrent change\n')

    async def test_new_file_write(self):
        rid = await self.new('write', path='new.txt', content_b64=base64.b64encode(b'new\n').decode())
        await self.decide(rid, 'preview')
        await self.decide(rid, 'approve')
        self.assertEqual((d.DRIVES / 'c/new.txt').read_text(), 'new\n')

    async def test_literal_search(self):
        rid = await self.new('search', path='.', query='PRIVATE')
        await self.decide(rid, 'approve')
        result = self.broker.requests[rid]['result']
        self.assertEqual(result['matches'][0]['path'], 'secret.txt')

    async def test_listing(self):
        rid = await self.new('list', path='.')
        await self.decide(rid, 'approve')
        self.assertEqual(self.broker.requests[rid]['result']['entries'][0]['name'], 'secret.txt')

    async def test_agent_cannot_access_admin_password(self):
        if not self.uid_isolation:
            self.skipTest('Distinct UIDs unavailable in this host workspace')
        code = 'import os,sys;os.setgroups([]);os.setgid(21001);os.setuid(21001);open(sys.argv[1]).read()'
        proc = await asyncio.create_subprocess_exec(sys.executable, '-c', code,
            str(d.STATE / 'admin-password'), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await proc.communicate()
        self.assertNotEqual(proc.returncode, 0)
        self.assertNotIn(self.broker.password.encode(), out)
        self.assertIn(b'PermissionError', err)

    async def test_launcher_drops_uid_and_capabilities(self):
        if not self.uid_isolation:
            self.skipTest('Distinct UIDs unavailable in this host workspace')
        command = ['sh', '-c', 'id -u; sed -n "/^CapEff:/p; /^NoNewPrivs:/p" /proc/self/status']
        env = {**os.environ, 'DEVBOX_STATE': str(d.STATE), 'DEVBOX_RUN': str(d.RUN)}
        proc = await asyncio.create_subprocess_exec(sys.executable, str(d.HERE / 'devbox.py'),
            'as-agent', 'claude', *command, env=env,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await proc.communicate()
        self.assertEqual(proc.returncode, 0, err.decode())
        text = out.decode()
        self.assertIn('21001', text)
        self.assertRegex(text, r'CapEff:\s*0+\b')
        self.assertRegex(text, r'NoNewPrivs:\s*1')

    async def test_authenticated_terminal_http_and_websocket_proxy(self):
        if not self.uid_isolation:
            self.skipTest('Unix sockets unavailable in this host workspace')
        async def backend(request):
            if request.path.endswith('/ws'):
                ws = web.WebSocketResponse()
                await ws.prepare(request)
                async for message in ws:
                    if message.type == d.WSMsgType.TEXT:
                        await ws.send_str(message.data)
                    else:
                        break
                return ws
            return web.Response(text='Terminal backend fixture')
        app = web.Application()
        app.router.add_get('/terminal/{tail:.*}', backend)
        runner = web.AppRunner(app)
        await runner.setup()
        await web.UnixSite(runner, str(d.RUN / 'private/ttyd.sock')).start()
        try:
            async with self.client.get(self.url + '/terminal/') as response:
                self.assertEqual(await response.text(), 'Terminal backend fixture')
            async with self.client.ws_connect(self.url + '/terminal/ws', headers={'Origin': self.url}) as ws:
                await ws.send_str('live terminal echo')
                result = await asyncio.wait_for(ws.receive(), 3)
                self.assertEqual(result.data, 'live terminal echo')
        finally:
            await runner.cleanup()


class LimitTests(unittest.TestCase):
    """Limits default to unlimited (0); a positive value still caps."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='devbox-limits-')
        self.old = d.DRIVES, d.CFG
        d.DRIVES = Path(self.temp.name)
        (d.DRIVES / 'c').mkdir()
        (d.DRIVES / 'c/big.bin').write_bytes(b'x' * 6000000)
        d.CFG = d.load_config()

    def tearDown(self):
        d.DRIVES, d.CFG = self.old
        self.temp.cleanup()

    def test_defaults_are_unlimited(self):
        for key in ('max_file_bytes', 'max_entries', 'search_max_files', 'search_max_bytes'):
            self.assertEqual(d.CFG[key], 0, key)

    def test_large_read_allowed_by_default(self):
        data, _ = d.read_file('c', 'big.bin')
        self.assertEqual(len(data), 6000000)

    def test_configured_cap_still_applies(self):
        d.CFG['max_file_bytes'] = 1000
        with self.assertRaises(ValueError):
            d.read_file('c', 'big.bin')

    def test_search_without_file_cap(self):
        for i in range(300):
            (d.DRIVES / 'c' / f'f{i}.txt').write_text('needle\n')
        result = d.execute({'op': 'search', 'drive': 'c', 'path': '.', 'query': 'needle'})
        self.assertEqual(len(result['matches']), 300)
        self.assertFalse(result['truncated'])


def run():
    if Path('/proc/self/uid_map').read_text().split() == ['0', '0', '1']:
        print('Portable handler/filesystem mode: this host maps only UID 0. '
              'Real process-identity and socket integration checks require docker run IMAGE self-test.', flush=True)
    suite = unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(SecurityTests),
                                unittest.defaultTestLoader.loadTestsFromTestCase(LimitTests)])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.skipped and os.environ.get('DEVBOX_PORTABLE_TESTS') != '1':
        print('FAIL: full UID isolation tests were skipped. Use a Docker host with mapped agent UIDs.', file=sys.stderr)
        return 1
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(run())


SELFTEST_PY

COPY <<'DEFAULTS_JSON' /opt/devbox/defaults.json
{
  "max_file_bytes": 0,
  "max_entries": 0,
  "search_max_files": 0,
  "search_max_bytes": 0,
  "approval_timeout_seconds": 600,
  "notify_interval_seconds": 5,
  "web_port": 8090,
  "require_mounts": true,
  "approval_totp_secret": "",
  "openwebui_url": "",
  "openwebui_model": "",
  "launch_commands": {
    "codex": [
      "codex",
      "--ask-for-approval", "on-request",
      "-c", "default_permissions=\"host-broker\"",
      "-c", "permissions.host-broker.extends=\":workspace\"",
      "-c", "features.network_proxy=true",
      "-c", "permissions.host-broker.network.enabled=true",
      "-c", "permissions.host-broker.network.unix_sockets={\"/run/devbox/agent.sock\"=\"allow\"}"
    ]
  }
}

DEFAULTS_JSON

COPY <<'AGENT_BASHRC' /opt/devbox/agent.bashrc
export PS1='\[\e[32m\]${DEVBOX_AGENT}@devbox\[\e[0m\]:\w\$ '
agent-start() {
  /usr/bin/python3 /opt/devbox/devbox.py agent-start
}
agent-login() {
  case "$DEVBOX_AGENT" in
    claude) claude auth login ;;
    codex) codex login --device-auth ;;
    grok) grok login --device-auth ;;
    agy) agy ;;
    opencode) printf '%s\n' 'OpenCode uses the Open WebUI runtime settings. Run agent-start.' ;;
    pi) printf '%s\n' 'Run agent-start, then /login inside Pi.' ;;
    qwen) printf '%s\n' 'Run agent-start, then complete /auth inside Qwen Code.' ;;
  esac
}
printf '\n%s\n' "Agent: $DEVBOX_AGENT. Host access: hostctl --help. Login: agent-login. Reopen: agent-start."
printf '%s\n' 'Host operations wait for your approval at the browser dashboard.'
agent-start


AGENT_BASHRC

RUN <<'WRAPPERS'
set -eu
cat > /usr/local/bin/devbox <<'SH'
#!/bin/sh
exec /usr/bin/python3 /opt/devbox/devbox.py "$@"
SH
cat > /usr/local/bin/devbox-pane <<'SH'
#!/bin/sh
exec /usr/bin/python3 /opt/devbox/devbox.py pane
SH
cat > /usr/local/bin/hostctl <<'SH'
#!/bin/sh
exec /usr/bin/python3 /opt/devbox/devbox.py host "$@"
SH
cat > /usr/local/bin/teamctl <<'SH'
#!/bin/sh
exec /usr/bin/python3 /opt/devbox/devbox.py team "$@"
SH
cat > /usr/local/bin/print-browser-url <<'SH'
#!/bin/sh
printf '\nOpen this URL in your host browser:\n'
printf '%s\n' "$@"
SH
chmod 0755 /usr/local/bin/devbox /usr/local/bin/devbox-pane \
    /usr/local/bin/hostctl /usr/local/bin/teamctl /usr/local/bin/print-browser-url
# Root-owned managed policy: Claude Code must always ask before relaying an approval.
install -d -m 0755 /etc/claude-code
cat > /etc/claude-code/managed-settings.json <<'JSON'
{"permissions": {"defaultMode": "default",
 "allow": [
  "Bash(hostctl list *)", "Bash(hostctl read *)", "Bash(hostctl search *)",
  "Bash(hostctl write *)", "Bash(hostctl pending)", "Bash(hostctl pending *)",
  "Bash(teamctl status)", "Bash(teamctl read *)"],
 "ask": [
  "Bash(hostctl approve *)", "Bash(hostctl preview *)",
  "Bash(devbox host approve *)", "Bash(devbox host preview *)",
  "Bash(*devbox.py host approve*)", "Bash(*devbox.py host preview*)"]}}
JSON
chmod 0644 /etc/claude-code/managed-settings.json
python3 -m py_compile /opt/devbox/devbox.py /opt/devbox/selftest.py
bash -n /opt/devbox/agent.bashrc
{
    node --version
    herdr --version
    claude --version
    codex --version
    agy --version
    grok --version
    opencode --version
    pi --version
    qwen --version
    ttyd --version
} > /opt/devbox/versions.txt
# Full tests run inside the build; skips fail unless explicitly enabled for local development.
python3 /opt/devbox/devbox.py self-test
WRAPPERS
WORKDIR /state
EXPOSE 8090 4096
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "-s", "--", "/usr/local/bin/devbox"]
CMD ["start"]
```
{% endraw %}

### `build.sh`

Prepares the seccomp profile, builds the image, and runs the self-test.

{% raw %}
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
image="${DEVBOX_IMAGE:-herdr-devbox}"

python3 "$script_dir/prepare-seccomp.py"

command -v docker >/dev/null 2>&1 || {
  printf 'Docker is not installed or is not on PATH.\n' >&2
  exit 1
}
[[ -f "$script_dir/Dockerfile" ]] || {
  printf 'Place build.sh beside Dockerfile.\n' >&2
  exit 1
}
docker info >/dev/null

docker build --pull --tag "$image" --file "$script_dir/Dockerfile" "$script_dir"
docker run --rm "$image" self-test
printf '\nFile/search limits default to unlimited (0); override via DEVBOX_CONFIG.'
printf '\nBuilt and checked %s. Start it with: bash %q/run.sh\n' "$image" "$script_dir"
```
{% endraw %}

### `run.sh`

Asks for settings, starts the container, and prints the secrets.

{% raw %}
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

image="${DEVBOX_IMAGE:-herdr-devbox}"
container="${DEVBOX_CONTAINER:-herdr-devbox}"
state_volume="${DEVBOX_VOLUME:-herdr-devbox-state}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -r "$script_dir/herdr-seccomp.json" ]]; then
  printf 'Missing seccomp profile: %s/herdr-seccomp.json\n' "$script_dir" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  printf 'Docker is not installed or is not on PATH.\n' >&2
  exit 1
}
command -v mountpoint >/dev/null 2>&1 || {
  printf 'Run this script in WSL with the mountpoint utility installed.\n' >&2
  exit 1
}
docker info >/dev/null
docker image inspect "$image" >/dev/null 2>&1 || {
  printf 'Image %s was not found. Run bash build.sh first.\n' "$image" >&2
  exit 1
}

for drive in c d x; do
  if ! mountpoint -q "/mnt/$drive"; then
    printf 'Missing drive mount: /mnt/%s. Mount the actual drive/share in WSL first.\n' "$drive" >&2
    exit 1
  fi
done

# Prevent inherited shell tracing from revealing the API key during expansion.
set +x
trap 'unset OPENWEBUI_API_KEY' EXIT

# Open WebUI settings are cached inside the state volume (/state/secrets, root-only, so no
# agent can read them). Later starts only ask whether to change them.
OPENWEBUI_URL=''
OPENWEBUI_MODEL=''
OPENWEBUI_API_KEY=''
cached=()

devbox_py() {
  # Runs a devbox.py helper against the state volume; names passed via -e keep the key off the command line.
  docker run --rm --entrypoint /usr/bin/python3 --security-opt no-new-privileges=true \
    --mount "type=volume,src=$state_volume,dst=/state" "$@"
}

# Lists the endpoint's models (the OpenCode and Pi plugins expose all of them; this only picks
# the startup default). Uses what you just typed, or the cached URL/key for whatever you left unset.
pick_model() {
  local env_args=() models=() choice i
  [[ -n "$OPENWEBUI_URL" ]] && { export OPENWEBUI_URL; env_args+=(-e OPENWEBUI_URL); }
  [[ -n "$OPENWEBUI_API_KEY" ]] && { export OPENWEBUI_API_KEY; env_args+=(-e OPENWEBUI_API_KEY); }
  if ! mapfile -t models < <(devbox_py "${env_args[@]}" "$image" /opt/devbox/devbox.py openwebui-models 2>/dev/null) \
      || ((${#models[@]} == 0)); then
    printf 'Could not list models from the endpoint; enter the model ID by hand.\n' >&2
    return 1
  fi
  printf '\nModels available on the endpoint (%d):\n' "${#models[@]}"
  for i in "${!models[@]}"; do
    ((i < 40)) && printf '  %2d) %s\n' "$((i + 1))" "${models[i]}"
  done
  ((${#models[@]} > 40)) && printf '  ... and %d more (type an ID to use one of them)\n' "$((${#models[@]} - 40))"
  while true; do
    read -r -p "Default model [number or exact ID${OPENWEBUI_MODEL:+, Enter keeps $OPENWEBUI_MODEL}]: " choice
    if [[ -z "$choice" && -n "$OPENWEBUI_MODEL" ]]; then
      return 0
    elif [[ "$choice" =~ ^[0-9]+$ ]] && ((choice >= 1 && choice <= ${#models[@]})); then
      OPENWEBUI_MODEL="${models[choice - 1]}"
      return 0
    elif [[ "$choice" =~ [^[:space:]] ]] && printf '%s\n' "${models[@]}" | grep -qxF -- "$choice"; then
      OPENWEBUI_MODEL="$choice"
      return 0
    fi
    printf 'Choose a listed number or an exact model ID.\n' >&2
  done
}

if mapfile -t cached < <(devbox_py "$image" /opt/devbox/devbox.py openwebui-show 2>/dev/null) && ((${#cached[@]} == 3)); then
  printf 'Saved Open WebUI settings:\n  URL:   %s\n  Model: %s\n  Key:   (saved, hidden)\n' "${cached[0]}" "${cached[1]}"
  read -r -p 'Change them? [y/N]: ' change
  if [[ ! "$change" =~ ^[Yy] ]]; then
    read -r -p 'Pick a different default model from the endpoint? [y/N]: ' repick
    if [[ "$repick" =~ ^[Yy] ]]; then
      OPENWEBUI_MODEL="${cached[1]}"
      pick_model || read -r -p 'Model ID: ' OPENWEBUI_MODEL
    fi
    cached=(keep)
  fi
else
  cached=()
fi

if [[ "${cached[0]:-}" != keep ]]; then
  while true; do
    read -r -p "Open WebUI URL (for example https://webui.example.org) [${cached[0]:-}]: " OPENWEBUI_URL
    OPENWEBUI_URL="${OPENWEBUI_URL:-${cached[0]:-}}"
    [[ "$OPENWEBUI_URL" =~ ^https?://[^[:space:]]+$ ]] && break
    printf 'Enter a complete http:// or https:// URL without spaces.\n' >&2
  done
  while true; do
    read -r -s -p 'Open WebUI API key (hidden; Enter keeps the saved key if there is one): ' OPENWEBUI_API_KEY
    printf '\n'
    [[ -n "$OPENWEBUI_API_KEY" || "${cached[2]:-}" == key ]] && break
    printf 'The API key cannot be empty.\n' >&2
  done
  OPENWEBUI_MODEL="${cached[1]:-}"
  if ! pick_model; then
    while true; do
      read -r -p "Open WebUI model ID (exact identifier) [${cached[1]:-}]: " OPENWEBUI_MODEL
      OPENWEBUI_MODEL="${OPENWEBUI_MODEL:-${cached[1]:-}}"
      [[ "$OPENWEBUI_MODEL" =~ [^[:space:]] ]] && break
      printf 'The model ID cannot be empty.\n' >&2
    done
  fi
fi
# Only values you entered are passed; anything left unset is loaded from the cached volume copy.
openwebui_args=()
[[ -n "$OPENWEBUI_URL" ]] && { export OPENWEBUI_URL; openwebui_args+=(-e OPENWEBUI_URL); }
[[ -n "$OPENWEBUI_MODEL" ]] && { export OPENWEBUI_MODEL; openwebui_args+=(-e OPENWEBUI_MODEL); }
[[ -n "$OPENWEBUI_API_KEY" ]] && { export OPENWEBUI_API_KEY; openwebui_args+=(-e OPENWEBUI_API_KEY); }
bind="${DEVBOX_BIND:-127.0.0.1}"
# Optional: DEVBOX_TOTP_SECRET (base32) fixes the Claude-session approval authenticator secret.
totp_args=()
if [[ -n "${DEVBOX_TOTP_SECRET:-}" ]]; then
  printf '\nUsing DEVBOX_TOTP_SECRET from your environment; it replaces any saved approval secret.\n'
  totp_args=(-e DEVBOX_TOTP_SECRET)
elif devbox_py "$image" /opt/devbox/devbox.py secret-exists totp 2>/dev/null; then
  # The saved secret lives in the root-only state volume, so it survives restarts and rebuilds.
  read -r -p $'\nA saved approval (TOTP) secret exists. Overwrite it? [y/N]: ' overwrite
  if [[ "$overwrite" =~ ^[Yy] ]]; then
    while true; do
      read -r -s -p 'New base32 secret (Enter generates a random one): ' DEVBOX_TOTP_SECRET
      printf '\n'
      if [[ -z "$DEVBOX_TOTP_SECRET" ]]; then
        totp_args=(-e DEVBOX_TOTP_REGENERATE=1)
        break
      elif [[ "$DEVBOX_TOTP_SECRET" =~ ^[A-Za-z2-7\ ]{16,}$ ]]; then
        export DEVBOX_TOTP_SECRET
        totp_args=(-e DEVBOX_TOTP_SECRET)
        break
      fi
      printf 'Enter at least 16 base32 characters (A-Z, 2-7), or press Enter to generate one.\n' >&2
    done
  else
    printf 'Keeping the saved approval secret.\n'
  fi
fi

# Dashboard and OpenCode passwords are saved in the state volume the same way. Ask before replacing.
password_args=()
ask_password() {  # label, secret-name, explicit env var, regenerate env var
  local label="$1" name="$2" explicit="$3" regen="$4" overwrite value
  if [[ -n "${!explicit:-}" ]]; then
    printf '\nUsing %s from your environment; it replaces the saved %s password.\n' "$explicit" "$label"
    export "$explicit"
    password_args+=(-e "$explicit")
  elif devbox_py "$image" /opt/devbox/devbox.py secret-exists "$name" 2>/dev/null; then
    read -r -p "A saved $label password exists. Overwrite it? [y/N]: " overwrite
    if [[ "$overwrite" =~ ^[Yy] ]]; then
      while true; do
        read -r -s -p "New $label password (at least 12 characters, no spaces; Enter generates one): " value
        printf '\n'
        if [[ -z "$value" ]]; then
          password_args+=(-e "$regen=1")
          break
        elif [[ ${#value} -ge 12 && ! "$value" =~ [[:space:]] ]]; then
          printf -v "$explicit" '%s' "$value"
          export "$explicit"
          password_args+=(-e "$explicit")
          break
        fi
        printf 'Use at least 12 characters with no spaces, or press Enter to generate one.\n' >&2
      done
    else
      printf 'Keeping the saved %s password.\n' "$label"
    fi
  fi
}
ask_password 'dashboard' admin DEVBOX_ADMIN_PASSWORD DEVBOX_ADMIN_REGENERATE
ask_password 'OpenCode' opencode DEVBOX_OPENCODE_PASSWORD DEVBOX_OPENCODE_REGENERATE

printf '\nImage: %s\nContainer: %s\n' "$image" "$container"

if docker container inspect "$container" >/dev/null 2>&1; then
  printf '\nContainer %s already exists.\n' "$container"
  printf 'Recreating it stops its active jobs and removes its container filesystem.\n'
  printf 'Agent state in named volume %s is preserved.\n' "$state_volume"
  read -r -p "Type recreate to stop and remove $container, then apply these settings: " answer
  if [[ "$answer" != recreate ]]; then
    printf 'Cancelled. The existing container was left untouched.\n'
    exit 0
  fi
  docker stop "$container" >/dev/null
  docker rm "$container" >/dev/null
fi

printf '\nDashboard: http://%s:8090 (bind address from DEVBOX_BIND)\n' "$bind"
printf 'The devbox will print the dashboard password when startup completes.\n\n'

# Passing variable names keeps the key out of Docker command-line arguments.
# Docker receives it from this process environment. The devbox persists its
# generated OpenCode configuration in the private state volume.
docker run -d --restart unless-stopped --name "$container" \
  --security-opt no-new-privileges=true \
  --security-opt seccomp="$script_dir/herdr-seccomp.json" \
  --mount "type=volume,src=$state_volume,dst=/state" \
  --mount type=bind,src=/mnt/c,dst=/host-private/c \
  --mount type=bind,src=/mnt/d,dst=/host-private/d \
  --mount type=bind,src=/mnt/x,dst=/host-private/x \
  --add-host=host.docker.internal:host-gateway \
  -p "$bind:8090:8090" \
  -p "$bind:4096:4096" \
  "${openwebui_args[@]}" \
  "${totp_args[@]}" \
  "${password_args[@]}" \
  "$image"

for _ in $(seq 1 60); do
  docker exec "$container" test -s /state/secrets/approval-totp 2>/dev/null && break
  sleep 1
done
# Always show the approval secret, wherever it came from; fall back to reading the volume directly.
totp_secret="$(docker exec "$container" cat /state/secrets/approval-totp 2>/dev/null ||
  devbox_py "$image" -c "print(open('/state/secrets/approval-totp').read().strip())" 2>/dev/null || true)"
printf '\nClaude approval authenticator secret (base32):\n%s\n' "${totp_secret:-(unavailable: run docker logs $container)}"
if [[ -n "$totp_secret" ]]; then
  printf '\nURI: otpauth://totp/HerdR%%20devbox:approvals?secret=%s&issuer=HerdR%%20devbox\n' "$totp_secret"
fi
show_secret() {  # path inside the volume; falls back to reading the volume directly
  docker exec "$container" cat "$1" 2>/dev/null ||
    devbox_py "$image" -c "import sys;print(open(sys.argv[1]).read().strip())" "$1" 2>/dev/null ||
    printf '(unavailable: see docker logs %s)' "$container"
}
printf '\nHerdr Admin (http://localhost:8090) password: %s\n' "$(show_secret /state/admin-password)"
printf '\nOpencode (http://localhost:4096, username opencode) password: %s\n' "$(show_secret /state/secrets/opencode-password)"
```
{% endraw %}

### `attach.sh`

Attaches Herdr to the running container.

{% raw %}
```bash
#!/bin/bash
echo "Detach with Ctrl+B, then Q. The background container keeps running."
docker exec -it herdr-devbox /usr/local/bin/devbox attach
```
{% endraw %}

### `prepare-seccomp.py`

Creates the seccomp profile that lets bubblewrap work.

{% raw %}
```python
#!/usr/bin/env python3
"""Create a candidate Docker profile for Bubblewrap; never overwrite a file.

Start from Moby's published default, retain its default-deny policy and all
existing rules, then allow six namespace and mount syscalls. This broadens
kernel exposure for every process in the container, not only Codex. Kernel
namespace ownership and capability checks still apply. Validate in a disposable
container before using it with host mounts. This is not a security certification.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import traceback
import urllib.request

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, help='Use an existing upstream default JSON instead of the cached or downloaded one')
    parser.add_argument('--output', type=Path, default=HERE / 'herdr-seccomp.json')
    args = parser.parse_args()
    if args.output.exists():
        print(f'Skipping, file exists: {args.output}')
        exit(0)
    url = 'https://raw.githubusercontent.com/moby/profiles/main/seccomp/default.json'
    cache = HERE / 'default.json'
    if args.base:
        raw = args.base.read_bytes()
        source = str(args.base)
    elif cache.exists():
        raw = cache.read_bytes()
        source = f'{cache} (cached)'
    else:
        with urllib.request.urlopen(url, timeout=30) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise ValueError('Upstream profile exceeds 1 MiB')
        json.loads(raw)  # Validate before caching so a bad download is never reused.
        with cache.open('xb') as saved:
            saved.write(raw)
        source = f'{url} (downloaded, saved to {cache})'
    if len(raw) > 1024 * 1024:
        raise ValueError('Upstream profile exceeds 1 MiB')
    profile = json.loads(raw)
    if profile.get('defaultAction') != 'SCMP_ACT_ERRNO':
        raise ValueError('Expected an upstream default-deny profile')
    rules = profile.get('syscalls')
    if not isinstance(rules, list) or not rules:
        raise ValueError('Missing upstream syscall rules')
    changed = {'clone', 'unshare', 'mount', 'umount2', 'pivot_root', 'setns'}
    for rule in rules:
        if changed.intersection(rule.get('names', [])) and rule.get('action') != 'SCMP_ACT_ALLOW':
            raise ValueError('Upstream has a conflicting explicit deny rule; review it manually')
    # clone3 stays at the upstream policy. The legacy clone interface permits
    # argument filtering; clone3 passes flags through a pointer, which ordinary
    # seccomp filters cannot inspect. This candidate targets x86_64/ARM64 only.
    # Preserve existing clone rules, adding namespace creation except cgroups.
    rules.append({'names': ['clone'], 'action': 'SCMP_ACT_ALLOW',
                  'args': [{'index': 0, 'value': 0x02000000, 'valueTwo': 0,
                            'op': 'SCMP_CMP_MASKED_EQ'}]})
    # Permit user, mount, PID, network, IPC, UTS and SYSVSEM unshare flags.
    permitted = 0x10000000 | 0x00020000 | 0x20000000 | 0x40000000 | 0x08000000 | 0x04000000 | 0x00040000
    rules.append({'names': ['unshare'], 'action': 'SCMP_ACT_ALLOW',
                  'args': [{'index': 0, 'value': ((1 << 64) - 1) ^ permitted,
                            'valueTwo': 0, 'op': 'SCMP_CMP_MASKED_EQ'}]})
    rules.append({'names': ['mount', 'umount2', 'pivot_root', 'setns'],
                  'action': 'SCMP_ACT_ALLOW'})
    with args.output.open('x', encoding='utf-8') as output:
        json.dump(profile, output, indent=2)
        output.write('\n')
    print(f'Created candidate: {args.output.resolve()}')
    print(f'Base SHA256: {hashlib.sha256(raw).hexdigest()}')
    print('Base: ' + source)
    print('Added permissions: ' + ', '.join(sorted(changed)))
    print('Test in a disposable container before using with host mounts.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'[prepare-seccomp.main] {e}', file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
```
{% endraw %}

### `totp_generate.sh`

Computes the current approval code from the secret.

{% raw %}
```bash
#!/usr/bin/env bash
# Prompt for the devbox approval TOTP secret (base32 or a pasted otpauth:// URI) and print
# the current six-digit code. Retrieve the secret with:
#   docker exec herdr-devbox cat /state/secrets/approval-totp
# Usage: bash totp_generate.sh [--watch]   (--watch refreshes until Ctrl+C)
set -Eeuo pipefail
set +x

command -v python3 >/dev/null 2>&1 || {
  printf 'python3 is required.\n' >&2
  exit 1
}

watch=0
[[ "${1:-}" == "--watch" ]] && watch=1

read -r -s -p 'TOTP secret (hidden, base32 or otpauth:// URI): ' TOTP_SECRET
printf '\n'
[[ -n "$TOTP_SECRET" ]] || {
  printf 'The secret cannot be empty.\n' >&2
  exit 1
}
export TOTP_SECRET TOTP_WATCH="$watch"
trap 'unset TOTP_SECRET' EXIT

# The secret travels in the environment, not on the command line.
python3 -I - <<'PY'
import base64, hashlib, hmac, os, re, struct, sys, time
from urllib.parse import parse_qs, urlsplit

raw = os.environ['TOTP_SECRET'].strip()
if raw.lower().startswith('otpauth://'):
    values = parse_qs(urlsplit(raw).query).get('secret')
    if not values:
        sys.exit('The otpauth URI has no secret parameter.')
    raw = values[0]
secret = re.sub(r'[\s-]', '', raw).upper()
try:
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
except Exception:
    sys.exit('That is not a valid base32 secret.')


def code(counter):
    digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return '%06d' % ((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000)


def show(end):
    now = time.time()
    print('Code: %s   (valid for about %ds)' % (code(int(now // 30)), 30 - int(now % 30)), end=end, flush=True)


if os.environ.get('TOTP_WATCH') == '1':
    try:
        last = None
        while True:
            counter = int(time.time() // 30)
            if counter != last:
                last = counter
                print()
                show('')
            time.sleep(0.5)
    except KeyboardInterrupt:
        print()
else:
    show('\n')
PY
```
{% endraw %}

