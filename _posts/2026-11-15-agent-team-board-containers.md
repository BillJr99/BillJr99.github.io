---
title: 'Running a Team of Coding Agents: One Supervisor, a Shared Job Board, and Throwaway Containers'
date: 2026-11-15
permalink: /posts/2026/11/agent-team-board-containers/
tags:
 - ai
 - agentic
 - herdr
 - docker
 - security
---

Once more than a dozen coding agents were installed and running side by side under [Herdr](https://herdr.dev/), as I describe in [Herding Agents](/posts/2026/10/herdr-multiagent-mcpproxy/), running them stopped being the hard part.  The hard part became running them *together*: deciding which agent does which job, making sure a job survives when one agent hands it to another, and keeping experiments away from anything that matters.  Three things made that work for me: one agent that supervises the others, a shared job board that any agent can pick up from, and throwaway containers for anything risky.  The post ends with the working rules that keep the whole arrangement safe.

## One agent supervises the rest

Every agent runs in its own labelled Herdr tab, with its own working folder, on a small always-on server.  Herdr recognizes each agent, so it can report each tab's state: working, done, idle, or blocked waiting for a person.  It also has a command line that can read a tab's screen and type into it.  That is enough for one agent to supervise the others.

The supervising agent reads a task, decides which agent should do each part, and hands each part over by typing a prompt into that agent's tab.  It then watches the tab's state and reads the reply.  This is the supervisor pattern from the multi-agent literature, except that the sub-agents are full coding agents instead of function calls, and the "roster" is the list of tab labels.

I route work through a small wrapper around Herdr's commands instead of letting the supervisor type into tabs directly.  The wrapper refuses three things:

- typing into a tab whose agent is still working;
- typing over text that someone has already typed at the computer;
- answering an approval prompt.

The last one matters most.  When an agent stops to ask permission, it is saying that a person should decide.  If the supervisor could answer for it, no person would be deciding at all.

The wrapper also does the routing.  Public, non-sensitive work goes to the agents on free plans first, and the agents I pay for, which have usage limits, get the hard problems.  When an agent's usage readout passes 95 percent of its allowance, or it reports a rate-limit error, the wrapper sets that agent aside until its usage resets.  Without that rule, a busy afternoon can run every paid plan to its limit.

## The person stays in the loop

A supervisor that may not answer approvals needs a person who can, and I am not always at the computer.  [HerdrDroid](/software/herdrdroid/), an Android app I wrote, signs in to the server over SSH and shows every tab as a card with its state, the model it runs, and how much of its usage allowance is left.  When an agent stops for approval, the question becomes a card with one button per answer, so I can approve, refuse, or redirect the work from my phone.

The recording below is made with demo data: a made-up computer and made-up tasks, but the real app.  A supervising agent splits a job three ways and dispatches the parts; the three agents go to work; one stops for approval, which is answered from the phone; and all three finish while the supervisor collects the results.

<video controls muted playsinline preload="metadata" width="270" poster="/files/media/2026-11-15-agent-team/herdrdroid-orchestration-poster.png">
  <source src="/files/media/2026-11-15-agent-team/herdrdroid-orchestration.mp4" type="video/mp4">
  A recording of HerdrDroid showing one agent dispatching work to three others, one approval answered from the phone, and all three finishing.
</video>

## A job board any agent can pick up

The supervisor solved "who does what."  It did not solve "what was I in the middle of."  An agent's context fills up, a session restarts, a job waits overnight for my approval, and the next agent to touch the work starts from nothing.

The fix is a shared job board: a folder named `kanban` on the server, with one short Markdown card per job.  A card is a handoff note that outlives any one session:

```markdown
---
id: release-notes-tool
title: "Release-notes tool: parser, README section, review"
status: review
owner: codex
requested: "Ship the release-notes tool today"
links: ["branch release-notes", "worktree ~/work/release-notes"]
---
## Goal         The parser, its tests and the README section are merged, and the review is clean.
## State        Branch release-notes at 1a2b3c4; six tests pass; review requested.
## Next step    Address the review, then merge and push.
## Resume notes Only the parser and the README change.  Approved by me on Nov 15.
## Log          Dated lines the tool appends as the work moves.
```

The statuses are `backlog`, `doing`, `blocked`, `waiting-on-me`, `review`, and `done`.  The **Next step** line does most of the work.  When it is exact, a different agent can open the card and continue without reading anything else.

Every change goes through a small command-line tool, and the folder is a git repository, so each new card, note, and status change becomes a commit.  The board's history is its own audit trail.  The tool is short; these are the commands every agent uses:

```bash
kanban list --mine                          # my open cards, with their next steps
kanban new release-notes-tool "Title" --status doing --next "Write the parser"
kanban note release-notes-tool "parser done, 6 tests pass, commit 1a2b3c4"
kanban set  release-notes-tool next "Ask for the review"
kanban move release-notes-tool review --note "review requested"
kanban report                               # waiting on me, blocked, done, in progress
```

Three rules make the board work:

- **Every agent works the board.**  Whenever an agent is idle or finishes a task, it lists its own cards and carries them forward without being asked.  A card waits only if it is waiting on me for a real decision.
- **Agents update cards as they go, not at the end.**  A note after each commit or test run is what makes a handoff possible when the session ends unexpectedly.
- **Done is reported, then removed.**  Each evening one agent sends me a short digest: what is waiting on me, what is blocked, and what finished.  The cards it reports as done are then removed from the board, and they stay in the git history.

I also keep a task list in a project tracker, and a scheduled job connects the two.  A task I add there becomes a card with an owner, and the task moves between the tracker's lists as its card moves.  The one thing the job may not do on its own is mark a task complete.  It asks me first, for the same reason the supervisor may not answer approvals.

## Throwaway containers for anything risky

The agents live on one server, and I want that server boring.  So every build, test, experiment, and exploration runs in a throwaway Docker container on a second machine.  The pattern is always the same: copy in the folder the job needs, run the command, copy the results back, and delete the container, its image, and its volumes.

```bash
host=docker-host                          # the second machine
run=dockrun-$(date +%Y%m%d-%H%M%S)
rsync -a ./ "$host:~/runs/$run/src/"      # copy the job in
ssh "$host" "docker run --rm -v ~/runs/$run/src:/work -w /work ubuntu:24.04 bash -c 'make test'"
rsync -a "$host:~/runs/$run/src/out/" ./out/   # results come back
ssh "$host" "docker image rm ubuntu:24.04"     # remove the image this run pulled
```

An agent that installs the wrong package, runs code it does not understand, or fills a disk damages nothing that outlives the run.  The container is a boundary the agent cannot talk its way out of, and the cleanup is part of the run instead of something someone has to remember.  The same three properties keep showing up: the container gives isolation, the copied-back results and logs give observability, and nothing being permanent gives reversibility.

## Guard rails for well-meaning agents

A few commands do damage that is hard to undo, so the agents' shells find small wrappers for them first on their `PATH`: `rm`, `rsync --delete`, and `sudo`.  Inside an agent's tab, each wrapper refuses and tells the agent to ask me; after I approve, the agent reruns the command with an explicit approval variable set.

```bash
#!/bin/bash
# ~/.local/bin/sudo: in an agent tab, sudo waits for a person's OK.
if [ -n "${HERDR_PANE_ID:-}" ] && [ "${OK_SUDO:-}" != 1 ]; then
  echo "sudo needs a person's OK. Ask, then rerun with OK_SUDO=1." >&2
  exit 77
fi
exec /usr/bin/sudo "$@"
```

These are guard rails for cooperating agents, not a security boundary.  An agent determined to get around one could call the real program by its full path.  What they catch is the far more common case: an agent that means well, is in a hurry, and would otherwise delete the wrong folder or reach for root to fix a permissions error.  Each refusal turns into a question in the agent's reply, so the decision comes to me.

## Working rules every agent follows

A few rules, written once in the instructions every agent reads, prevent most of the ways a well-meaning agent causes damage.

**Git commands are free; deletion asks.**  Agents may use git as much as they like, including `git rm`, `git restore`, and `git clean`, because everything git touches can be recovered from the history.  Plain `rm`, `rsync --delete`, and `sudo` go through the guard rails above and wait for a person.  When an agent wants a file out of the way, the default is to move it into a scratch folder instead of deleting it; the scratch folder is the recycle bin.

**Back up before overwriting, and check nothing changed.**  Before an agent writes over a file it copied earlier, it keeps a backup and confirms the file still matches the copy it started from.  If someone edited the file in the meantime, the agent stops instead of overwriting their work.

**Scripts fail closed.**  Every script an agent writes starts with `set -u`, checks that each input it depends on exists, and stops when one is missing, instead of carrying on with an empty variable.  A copy or a cleanup that guesses is far more dangerous than one that refuses.

```bash
set -u
[ -d "$SRC" ] || { echo "missing $SRC"; exit 1; }
```

**Replace, never overwrite in place.**  A script or a configuration file that something may be reading right now is installed by writing a new file and renaming it over the old one.  Anything already running keeps the old version, and the next run gets the new one.

```bash
cp new-version.sh script.sh.new && mv script.sh.new script.sh
```

**One job at a time on a shared resource.**  Jobs that use the same slow or fragile resource, such as a single build machine or a shared disk, take a lock and run one after another, with a generous wait instead of a short timeout that fails the job.

**A finished job points to its evidence.**  A card moves to done only when its **State** line names the proof: the commit, the file, the test result, or the page that now loads.  An agent's report that it finished does not count until something on the card confirms it.

**Approvals belong to a person.**  No agent answers another agent's approval prompt, completes a task in the tracker, or turns on an approve-everything mode without being asked.  An agent that is unsure asks in its reply, and the question lands on my phone.

## If I were starting over

I would set up the job board and the throwaway containers before adding a fourth agent, not after a dozen.  The supervisor gets the attention, but it only became trustworthy once every job left a written trail that another agent could pick up, and once every experiment ran somewhere it could not hurt anything.

## Resources

- [Herding Agents](/posts/2026/10/herdr-multiagent-mcpproxy/), the setup this post builds on
- [Herdr](https://herdr.dev/) and its [CLI reference](https://herdr.dev/docs/cli-reference/)
- [HerdrDroid](/software/herdrdroid/) and its [repository](https://github.com/BillJr99/HerdrDroid)
- [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run/)
