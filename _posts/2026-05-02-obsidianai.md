---
title: 'A Personal AI Knowledge Base: Obsidian, GitHub Sync, and Cross-Platform AI Context'
date: 2026-05-02
permalink: /posts/2026/05/obsidian-ai-vault/
tags:
 - ai
 - obsidian
 - knowledge-management
 - agents
 - markdown
---
 
For the past year I have been building a knowledge management system with a specific design constraint in mind: every AI system I work with, whether a cloud-hosted assistant, a local agentic coding tool, or an automated GitHub Action, should be able to read the same authoritative description of who I am, what I am working on, and how I want to interact. The proliferation of capable AI tools in 2025-2026 made this problem concrete in a way it had not been before. I was spending real time re-contextualizing each new tool at the start of every session, re-explaining the same preferences, the same active projects, the same institutional roles. The natural solution was to stop treating context as something you type into a chat box and start treating it as data you maintain in a repository. This post documents the architecture I settled on: an Obsidian vault hosted on GitHub, synchronized via the Gitless Sync plugin, structured around three canonical files that any AI system can read, and organized into a curated wiki that agents can query and extend.

## Motivation: Context as a First-Class Artifact

The practical problem is straightforward. Suppose you work with five or six AI tools on a regular basis: a web-based assistant with a custom instructions field, a local agentic coding CLI with a project context file, a GitHub-hosted agent that runs on repository events, and a few others. Each of these tools has its own mechanism for persistent context, and none of them are the same. You end up with five slightly different versions of your professional profile, your project list, and your working preferences, stored in five incompatible formats in five different places. When something changes, such as a grant award, a new course, a preference update, you update one and forget the others. The result is a system that gives different AI tools different pictures of you, which produces inconsistent behavior that is difficult to debug.

The deeper problem is that these tools are increasingly doing things that matter: drafting documents, running code, making commits, composing correspondence. Inconsistent context means inconsistent decisions about what to include, what to assume, and how to frame outputs. Getting this right is worth the architectural investment.

The solution I arrived at is to store context in a Git repository, maintain it with the same discipline I would apply to any other codebase, and give every AI system a well-specified path to read it. Obsidian provides the human-readable and human-editable interface. GitHub provides the hosting, versioning, and webhook surface that agents need. The Gitless Sync plugin provides the bridge between the two.

## Hardware and Local Setup

The vault lives on my primary workstation, which runs Linux Mint and is the same machine that hosts my local AI stack. Obsidian is installed as an AppImage and runs against a directory in my home filesystem. This placement is intentional: the vault is on the same machine as Ollama, LiteLLM, and the containerized agentic tools, so local agents can read it without any network call by bind-mounting the directory into their container.
 
The GitHub repository that backs the vault is a standard private repository. The local Obsidian directory and the GitHub repository are not connected through standard Git tooling on the workstation. There is no `.git` directory in the vault folder, no `git pull` or `git push` in any shell script, and no SSH key configured for this purpose. Synchronization is handled entirely by the Obsidian plugin described in the next section. This is a deliberate choice: it removes any risk of a merge conflict or detached HEAD state caused by operations outside of Obsidian, and it means the sync mechanism is consistent regardless of whether I am running Obsidian on my workstation, my laptop, or the mobile app.
 
## GitHub Gitless Sync: Plugin Setup
 
[Obsidian Gitless Sync](https://github.com/silvanocerza/obsidian-github-sync) is a community plugin that synchronizes an Obsidian vault directly with a GitHub repository using the GitHub REST API, without requiring Git to be installed locally and without creating a `.git` directory. Each file operation, create, modify, rename, delete, is translated into the corresponding GitHub API call, and the plugin tracks the synchronization state of every file in a local metadata file at `.obsidian/github-sync-metadata.json`.
 
Installation follows the standard community plugin path in Obsidian Settings: disable safe mode, browse community plugins, search for Gitless Sync, install, and enable. Configuration requires four values: a GitHub Personal Access Token with `repo` scope, the repository owner (your GitHub username), the repository name, and the branch to synchronize against. I use `main`.
 
```
GitHub PAT:     ghp_****************************
Repository:     username/obsidian-vault
Branch:         main
```
 
After configuration, the plugin performs an initial sync that either pushes the local vault to the empty repository or pulls a pre-existing repository into the local vault. Subsequent syncs are triggered manually through the command palette or automatically on a configurable interval. The sync direction is bidirectional: local changes are pushed to GitHub, and remote changes (including those made by agents or GitHub Actions) are pulled to the local vault.
 
The crucial detail for interoperability with external agents is the metadata file. Every file in the vault has a corresponding entry in `.obsidian/github-sync-metadata.json` that records its vault-relative path, its Git blob SHA, and a set of synchronization state flags. Any process that creates or modifies vault files outside of Obsidian (via the GitHub API or a GitHub Action) must update this metadata file in the same atomic commit, or the plugin will not see the change on the next sync. This constraint is the central design requirement that all external agent instructions must enforce.
 
## The SHA Computation Protocol
 
The `sha` field in the sync metadata is not a plain SHA-1 of the file's bytes. It is a Git blob SHA, which Git computes by prepending a header to the raw file content before hashing. Any agent that writes files to the repository and needs to pre-populate the metadata must implement this correctly.
 
The algorithm is:
 
1. Read the raw bytes of the file. Use the byte length, not the character count.
2. Construct the header string `blob {N}\0`, where `{N}` is the ASCII decimal representation of the byte length and `\0` is a literal null byte.
3. Concatenate the header bytes and the raw file bytes.
4. Apply SHA-1 to the concatenated byte stream.
5. Encode the result as a 40-character lowercase hexadecimal string.
This is exactly what `git hash-object` produces and what the GitHub REST API returns in the `sha` field of blob responses. The following Node.js implementation is what I provide to any agent working in this repository:
 
```typescript
import { createHash } from "crypto";
 
function computeGitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.byteLength}\0`);
  const input = Buffer.concat([header, content]);
  return createHash("sha1").update(input).digest("hex");
}
```
 
A common mistake is to hash the string representation of the content rather than the raw bytes. For files containing only ASCII text the results happen to match, but any file with multi-byte Unicode characters will produce an incorrect SHA that will cause the sync plugin to treat the file as modified on the next pull. Using the raw `Buffer` avoids this.
 
In practice, there is a simpler path for most agent use cases: set `sha` to `null` and `dirty` to `true` in the metadata entry after creating or modifying a file. The sync plugin will upload the file on the next sync and replace the null with the API-confirmed SHA. The full SHA computation is only necessary when you want to pre-cache the expected value and avoid a redundant upload.
 
## Vault Structure: The Three-Zone Design

The three-zone structure closely follows the layered architecture Andrej Karpathy described in his April 2026 LLM Wiki gist ([gist.github.com/karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)): immutable raw sources that the LLM reads but never modifies, a wiki layer of structured Markdown that the LLM writes and maintains, and a schema file (his term for what this vault calls `AGENTS.md`) that specifies conventions and workflows.

The vault is organized into three functional zones with strictly enforced read/write boundaries.
 
```
vault/
├── AGENTS.md           # Agent instructions (authoritative)
├── LLMMEMORIES.md      # Persistent user context for AI systems
├── SYSTEMPROMPT.md     # Standing system prompt and interaction preferences
├── raw/                # READ-ONLY source material inbox
│   └── *.md, *.pdf     # Unprocessed documents; never modified by agents
├── wiki/               # Curated, cross-linked knowledge base
│   ├── index.md        # Hub: overview and active projects
│   ├── Background/     # Education, credentials, appointment history
│   ├── Research/       # Grants, publications, active projects
│   ├── Teaching/       # Courses, tools, student supervision
│   ├── Service/        # Governance, advising, committees
│   ├── Outreach/       # CS education partnerships, podcast
│   └── Technical-Stack.md  # Tools and methods reference
└── .obsidian/
    └── github-sync-metadata.json   # Sync state (managed by plugin + agents)
```
 
The `raw/` directory is a one-way inbox. Documents are dropped there, either manually or by automated processes, and they are never touched again. Agents read from `raw/` and write exclusively to `wiki/`. This separation means that the curated knowledge base in `wiki/` is never contaminated by unprocessed source material, and source documents are never accidentally overwritten by agent activity.
 
The root-level canonical files are the only exception to the "no content at the root" rule. Their placement at the root is deliberate: any agent or automated system that clones the repository sees them immediately without needing to know anything about the vault's internal organization.
 
## AGENTS.md: Instructions for Automated Systems
 
`AGENTS.md` is the file that GitHub-hosted agents, agentic CLI tools (Claude Code, OpenCode, pi), and any other automated process reads first when it encounters this repository. It serves the same purpose as a `CLAUDE.md` or `AGENTS.md` file in a software project, but for a knowledge management system rather than a codebase.
 
The file opens with a non-negotiable preamble:
 
```markdown
# AGENT INSTRUCTIONS (MANDATORY)
 
You must read and follow all instructions in this file before performing
any actions in this repository.
 
If you have not read this file, stop and read it before continuing.
```
 
The body covers five topics. First, the repository role: what `raw/` and `wiki/` are for and what the agent's responsibility is. Second, the GitHub sync metadata protocol in full, including the SHA computation algorithm and the metadata schema, so that any agent writing files knows exactly how to keep the sync state consistent. Third, the relationship between `LLMMEMORIES.md` and `SYSTEMPROMPT.md` and how they should be treated as authoritative context. Fourth, the read/write boundaries, stated as explicit prohibitions. Fifth, the agent's core mandate: open the repository, read source materials, build and maintain the wiki, and commit changes.
 
The file is intentionally self-contained. An agent encountering this repository for the first time should be able to read `AGENTS.md` and operate correctly without any additional out-of-band context.
 
## LLMMEMORIES.md: Cross-Platform Persistent Memory
 
`LLMMEMORIES.md` is the canonical record of persistent user context. It is structured as a Markdown document with clearly delineated sections covering identity and roles, academic credentials, teaching responsibilities, research background, active projects, collaborators, and working preferences. The content is the same information I would otherwise re-type into the custom instructions field of every AI tool I use.
 
The key design principle is that this file is bidirectionally synchronized. When an AI system, through extended interaction, forms a more accurate or more detailed picture of some aspect of my context, that updated understanding should be written back into `LLMMEMORIES.md`. When `LLMMEMORIES.md` is updated in the repository, agents should read the new version at the start of their next session and treat it as authoritative. The file is, in effect, an externalized, version-controlled memory store.
 
A representative excerpt illustrates the level of specificity that makes this useful:
 
```markdown
## Current and Recent Scholarly / Funded Work
 
- Co-PI on MENTIR-AI (Gates Foundation, ~$500K, 2025-26): AI analysis and
  feedback of students' mathematical thinking, in collaboration with Drexel
  School of Education and the Math Forum; active tasks include RAG model
  development, A/B testing UI, agentic tutoring structures, and AWS
  infrastructure for multiple model deployments.
- PI on NSF S-STEM PERSIST grant ($1,999,659, pending): new grant focused
  on student persistence in STEM.
```
 
This level of specificity is what allows an agent to make correct decisions about framing, vocabulary, and assumptions without being told. A grant-writing agent that knows I am the PI on a pending NSF S-STEM award will frame a broader impacts section differently than one that only knows I am a computer science professor.
 
The file is organized to mirror the kinds of questions AI systems actually need to answer: who is this person, what are they working on right now, what are their technical preferences, who are their collaborators, and what institutional context applies to their work. Keeping it Markdown means every AI tool, regardless of its native format, can read it.
 
## SYSTEMPROMPT.md: Standing Instructions for Interaction Style
 
`SYSTEMPROMPT.md` captures the behavioral and stylistic instructions that I would otherwise paste into the system prompt or custom instructions field of each tool individually. It covers prose register, sentence structure preferences, hedging conventions, email style, code annotation expectations, exception handling patterns, and the confirmation protocol for irreversible actions.
 
The file is organized into numbered sections with explicit headings, which makes it easy to reference specific sections in an agent's instructions. The sections are designed to be consumed selectively: a writing assistant needs sections 2 and 4, a coding agent needs sections 3 and 8, a general-purpose assistant needs all of them.
 
One section that has proven particularly useful in agentic contexts is the confirmation gate protocol, which specifies categories of action, file deletion, email sending, git commits, public deployments, financial transactions, that require explicit confirmation before execution. Having this protocol written into a canonical file means that any agent that reads `SYSTEMPROMPT.md` inherits the same safety constraints, without requiring me to repeat them in every project's context file.
 
```markdown
## 8. CONFIRMATION GATES — REQUIRED BEFORE IRREVERSIBLE ACTIONS
 
A general instruction to "go ahead and handle everything" does NOT constitute
confirmation for actions in these categories. Each gate requires its own
confirmation at the moment of execution.
 
### 8.1 File System — Destructive or Significant Alterations
STOP and confirm before:
- Deleting any file or directory, regardless of perceived redundancy.
- Overwriting any existing file with new content.
```
 
The presence of this protocol in a repository-hosted file means that a GitHub Actions workflow can reference it, a local agentic tool can read it at startup, and a web-based assistant can be directed to it by URL. The instructions are not locked inside any single tool's configuration interface.
 
## Connecting AI Systems to the Vault
 
The practical integration pattern differs by tool type, but the underlying idea is the same in every case: give the tool a path to `AGENTS.md`, `LLMMEMORIES.md`, and `SYSTEMPROMPT.md`, and let those files do the context-setting work.
 
For **agentic CLI tools** like Claude Code and OpenCode, the integration is a `CLAUDE.md` or `AGENTS.md` file at the root of each project that begins with a fetch-and-read instruction pointing at the vault repository:
 
```markdown
## Context
 
Before beginning any task, fetch and read the following files from the
knowledge repository:
 
- https://raw.githubusercontent.com/username/obsidian-vault/main/LLMMEMORIES.md
- https://raw.githubusercontent.com/username/obsidian-vault/main/SYSTEMPROMPT.md
 
Treat the contents of those files as authoritative context for all decisions
in this session.
```
 
For **GitHub Actions workflows**, the vault repository is checked out as a secondary input in the workflow definition, and the canonical files are made available to any model invocation step:
 
```yaml
- name: Checkout knowledge vault
  uses: actions/checkout@v4
  with:
    repository: username/obsidian-vault
    token: ${{ secrets.VAULT_PAT }}
    path: vault
 
- name: Build context
  run: |
    cat vault/LLMMEMORIES.md vault/SYSTEMPROMPT.md > /tmp/context.md
```
 
For **web-based assistants** with a custom instructions field, I maintain a condensed version of `SYSTEMPROMPT.md` in that field, with a reference to the full repository for agents that can fetch URLs. The condensed version covers the highest-impact sections: identity, writing style, confirmation gates, and the location of the full canonical files.
 
For **local containerized agents**, the vault directory is bind-mounted directly into the container's filesystem:
 
```bash
docker run --rm -it \
  -v "$HOME/obsidian-vault:/vault:ro" \
  -v "$HOME/projects/current:/workspace" \
  my-agent:latest
```
 
The `:ro` flag is important: local agents should read from the vault, not write to it. Writes go through Obsidian and the Gitless Sync plugin, which maintains the metadata consistency that the sync protocol requires.
 
## The Wiki as a Queryable Knowledge Base
 
The `wiki/` directory is the output of the system, the structured knowledge base that gets built and maintained over time. Its current organization reflects the categories of professional activity it needs to represent: background and credentials, research and grants, teaching and tools, service and governance, outreach and community engagement.
 
Each subdirectory contains an `index.md` that provides a narrative summary of the area and links to the detailed files within it. Cross-links between files use Obsidian's standard `[[Note]]` link syntax, which Obsidian renders as navigable links in the UI and which agents can resolve by treating the link target as a vault-relative path. A research note might link to a teaching tool it informed; a grant page links to the publications that motivated it; a service role links to the institutional context that frames it.
 
The `wiki/index.md` serves as the hub for the entire knowledge base, listing active projects with direct links and providing a navigational entry point for any agent that needs to orient itself quickly:
 
```markdown
## Active Projects (April 2026)
 
- [[Research/MENTIR-AI|MENTIR-AI]] — AI feedback system for K–12 mathematics
- [[Service/S-STEM-PERSIST|S-STEM PERSIST]] — NSF grant kickoff; IRB and RA hiring
- [[Service/TLI|TLI]] — External review and end-of-year self-study in progress
- [[Teaching/WebIDE|WebIDE]] — SIGCSE TS 2026 published; CCSC submission in progress
```
 
When an agent is asked a question and instructed to consult the vault, it starts at `wiki/index.md`, identifies the relevant area, navigates to the appropriate subdirectory, reads the relevant files, and synthesizes an answer. This is the same workflow a human would follow when using Obsidian, which makes the agent behavior predictable and auditable.
 
## Reference Cataloging: The raw/ Inbox
 
The `raw/` directory handles a problem that anyone who works across multiple document formats encounters regularly: you receive a PDF, or an exported Asana project summary, or a transcript, and you need to incorporate the information into your knowledge base without losing the original source. The `raw/` inbox holds originals in whatever format they arrive: Markdown exports, PDFs, plaintext summaries. They are never modified.
 
When an agent runs against the repository, it reads `raw/` to discover new source material, extracts the relevant information, and writes structured notes to the appropriate location in `wiki/`. The original file in `raw/` becomes a reference that the wiki note can cite with a relative link: `[[../raw/260424 Mongan_CV.pdf]]`. Obsidian renders this as a clickable link that opens the original document; an agent resolves it as a vault-relative path.
 
The non-destructive contract of `raw/` means that the inbox can grow without risk. A new document dropped into `raw/` will be picked up on the next agent run and incorporated into the wiki, while the original is preserved for future reference or re-processing. This is a considerably more robust pattern than storing only the extracted text and discarding the source.
 
## Synchronization in Practice
 
The full synchronization cycle, from a local Obsidian edit to an agent seeing the change, involves three steps: edit in Obsidian, trigger a sync via the Gitless Sync plugin (which pushes changes to GitHub), and have the agent pull from the GitHub API or clone the repository fresh. The reverse cycle, from an agent commit to Obsidian seeing the change, is: agent writes to GitHub via the REST API (updating metadata correctly), Obsidian pulls on the next sync, and the new or modified file appears in the vault.
 
In steady-state operation, the sync is reliable and fast. The cases that require attention are the edge cases: an agent that creates a file without updating the metadata, a conflict between a local edit and a concurrent agent write, or a large batch of files created in a single operation. `AGENTS.md` documents all of these cases explicitly and specifies how each should be handled, which is why keeping those instructions in the repository itself rather than in a tool-specific configuration file is so valuable. Any agent, on any platform, reading the repository for the first time, receives the same complete set of instructions.
 
## Practical Takeaways
 
Running this system for the past year has produced a clear picture of what works and what requires ongoing attention. The three-file root structure (AGENTS.md, LLMMEMORIES.md, SYSTEMPROMPT.md) has proven to be the right level of granularity: enough separation to allow selective reading, not so much fragmentation that agents need to synthesize across many files to get a complete picture. The `raw/` read-only constraint has been invaluable; on two occasions, agents attempted to "clean up" source documents, and the prohibition in `AGENTS.md` was what stopped them. The bidirectional memory update convention for `LLMMEMORIES.md` is theoretically correct but requires discipline in practice: it is easy to accept a session's refined understanding and forget to write it back to the file.
 
The Gitless Sync plugin has been stable across Obsidian updates and across mobile and desktop platforms. The one operational requirement worth emphasizing is that the GitHub PAT must have `repo` scope and must not expire during active use. A token expiration silently breaks sync in a way that is not immediately obvious: Obsidian continues to operate against the local files, and the failure only becomes apparent when an agent cannot find changes you made two days ago.
 
The vault has become the single source of truth for the context that every AI tool I use draws from. Building it required perhaps two hours of initial setup and a few hours of content authoring. The ongoing maintenance cost is low: the files are Markdown, they live in a place I already had Obsidian pointed at, and the agents do most of the wiki-building work. The return, in terms of consistent, well-calibrated AI assistance across tools and sessions, has been substantially larger than the investment.
 
---
