---
title: 'A Private AI Knowledge Base: Obsidian, GitHub Sync, and Cross-Platform AI Context'
date: 2026-05-02
permalink: /posts/2026/05/obsidian-ai-vault/
tags:
 - ai
 - obsidian
 - knowledge-management
 - agents
 - markdown
---
 
For the past year I have been building a knowledge management system with a specific design constraint in mind: every AI system I work with, whether a cloud-hosted assistant, a local agentic coding tool, or an automated GitHub Action, should be able to read the same authoritative description of who I am, what I am working on, and how I want to interact. More importantly, those systems should be able to write back into the knowledge base and have their work appear seamlessly in Obsidian on my local machine the next time I open the app. The proliferation of capable AI tools in 2025-2026 made both sides of this problem, reading and writing, tractable in a way they had not been before. This post documents the architecture I settled on: an Obsidian vault hosted on GitHub, synchronized via the Gitless Sync plugin, structured around three canonical files that any AI system can read and act on, and organized into a curated wiki that agents can query, extend, and maintain across platforms.

## Motivation: Context as a First-Class Artifact
 
The practical problem is straightforward. Suppose you work with five or six AI tools on a regular basis: a web-based assistant with a custom instructions field, a local agentic coding CLI with a project context file, a GitHub-hosted agent that runs on repository events, and a few others. Each of these tools has its own mechanism for persistent context, and none of them are the same. You end up with five slightly different versions of your professional profile, your project list, and your working preferences, stored in five incompatible formats in five different places. When something changes, such as a new role, a new project, or a preference update, you update one and forget the others.
 
The deeper problem is that these tools are increasingly doing things that matter: drafting documents, running code, making commits, composing correspondence. Inconsistent context means inconsistent decisions about what to include, what to assume, and how to frame outputs. Getting this right is worth the architectural investment.
 
The solution is to store context in a Git repository, maintain it with the same discipline you would apply to any other codebase, and give every AI system a well-specified path to read from and write to it. Obsidian provides the human-readable and human-editable interface. GitHub provides the hosting, versioning, and webhook surface that agents need. The Gitless Sync plugin provides the bridge between the two, and the key insight of the design is that this bridge works in both directions: agents can push changes to GitHub and those changes will appear in Obsidian on the next sync, as long as they follow the metadata protocol described in `AGENTS.md`.
 
## Hardware and Local Setup
 
The vault lives on my primary workstation. Obsidian is installed and runs against a directory in the home filesystem. This placement is intentional: on machines that also run local agentic tools, the vault directory is on the same filesystem as the agent workspace, so local agents can read from or write to it without any network call by bind-mounting the directory into their container.
 
The GitHub repository that backs the vault is a standard private repository. The local Obsidian directory and the GitHub repository are not connected through standard Git tooling on the workstation. There is no `.git` directory in the vault folder, no `git pull` or `git push` in any shell script, and no SSH key configured for this purpose. Synchronization is handled entirely by the Obsidian plugin described in the next section. This is a deliberate choice: it removes any risk of a merge conflict or detached HEAD state caused by operations outside of Obsidian, and it means the sync mechanism is consistent regardless of whether I am running Obsidian on a desktop, a laptop, or the mobile app.
 
## GitHub Gitless Sync: Plugin Setup
 
[Obsidian Gitless Sync](https://github.com/silvanocerza/obsidian-github-sync) is a community plugin that synchronizes an Obsidian vault directly with a GitHub repository using the GitHub REST API, without requiring Git to be installed locally and without creating a `.git` directory. Each file operation, create, modify, rename, delete, is translated into the corresponding GitHub API call, and the plugin tracks the synchronization state of every file in a local metadata file at `.obsidian/github-sync-metadata.json`.
 
Installation follows the standard community plugin path in Obsidian Settings: disable safe mode, browse community plugins, search for Gitless Sync, install, and enable. Configuration requires four values: a GitHub Personal Access Token with `repo` scope, the repository owner, the repository name, and the branch to synchronize against.
 
After configuration, the plugin performs an initial sync that either pushes the local vault to the empty repository or pulls a pre-existing repository into the local vault. Subsequent syncs are triggered manually through the command palette or automatically on a configurable interval. The sync direction is bidirectional: local changes are pushed to GitHub, and remote changes, including those made by agents or GitHub Actions, are pulled to the local vault.
 
The operational requirement worth emphasizing is that the GitHub PAT must have `repo` scope and must not expire during active use. A token expiration silently breaks sync in a way that is not immediately obvious: Obsidian continues to operate against the local files, and the failure only becomes apparent when an agent's changes from two days ago have not appeared.
 
## The Key Insight: Agents Can Write, Not Just Read
 
A common misunderstanding about this setup is that it is read-only from the agent's perspective, with agents merely consuming context and humans maintaining the vault. The actual design is the opposite. Agents are the primary authors of `/wiki/`. Their job is to read source material from `/raw/`, synthesize it into structured Markdown, and write the results into `/wiki/` through the GitHub REST API. Those writes propagate to Obsidian on the next sync, and the result appears in the local vault as fully navigable, cross-linked notes.
 
The mechanism that makes this work is the metadata file. Any process that creates or modifies vault files through GitHub must also update `.obsidian/github-sync-metadata.json` in the same atomic commit. Without that update, Obsidian's sync plugin has no record of the change and will not pull it on the next sync. The entire agent write protocol is designed around maintaining this invariant. The full specification of how agents must behave is documented in `AGENTS.md`, linked and described in detail below.
 
## The SHA Computation Protocol
 
The `sha` field in the sync metadata is not a plain SHA-1 of the file's bytes. It is a Git blob SHA, which Git computes by prepending a header to the raw file content before hashing. Any agent writing to the repository and updating the metadata must implement this correctly, or the sync plugin will treat the file as modified on the next pull.
 
The algorithm is:
 
1. Read the raw bytes of the file. Use the byte length, not the character count; this distinction matters for any file containing multi-byte Unicode characters.
2. Construct the header string `blob {N}\0`, where `{N}` is the ASCII decimal representation of the byte length and `\0` is a literal null byte (0x00).
3. Concatenate the header bytes and the raw file bytes.
4. Apply SHA-1 to the concatenated byte stream.
5. Encode the result as a 40-character lowercase hexadecimal string.
This is exactly what `git hash-object` produces and what the GitHub REST API returns in the `sha` field of blob responses. A common mistake is to hash the string representation of the content rather than the raw bytes, or to apply SHA-1 without the header. Both produce incorrect values that will not match what GitHub stores.
 
In practice, there is a simpler path for most agent use cases: set `sha` to `null` and `dirty` to `true` in the metadata entry after creating or modifying a file. The sync plugin will upload the file on the next sync and replace the null with the API-confirmed SHA. The full SHA computation is only necessary when you want to pre-cache the expected value and avoid a redundant upload. Each metadata entry follows this schema:
 
```json
{
  "path": "relative/path/from/vault/root/to/file.md",
  "sha": "<40-char hex string or null>",
  "dirty": true,
  "justDownloaded": false,
  "lastModified": 1234567890000
}
```
 
After creating or modifying a file, set `dirty: true` and `lastModified` to `Date.now()` in milliseconds. The file and the metadata update must be committed together, atomically. Splitting them across separate commits will cause the sync plugin to mis-handle the change.
 
For deletions, the entry must include `deleted: true` and `deletedAt` alongside the path. The deleted file and the metadata update must again be committed in a single atomic operation.
 
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
│   ├── index.md        # Hub: overview and active work
│   └── */              # Subdirectories organized by domain
└── .obsidian/
    └── github-sync-metadata.json   # Sync state (managed by plugin + agents)
```
 
The `raw/` directory is a one-way inbox. Documents are dropped there and never touched again by anyone, human or agent. Agents read from `raw/` and write exclusively to `wiki/`. This separation means that the curated knowledge base in `wiki/` is never contaminated by unprocessed source material, and source documents are never accidentally overwritten by agent activity.
 
The root-level canonical files (`AGENTS.md`, `LLMMEMORIES.md`, `SYSTEMPROMPT.md`) are the only files that belong at the repository root. All authored content, every wiki page, every topic note, every hub index, belongs inside `wiki/` under an appropriate subdirectory. The root is intentionally clean. If a change appears to require a new root-level file or directory, the right answer is almost certainly that it belongs inside `wiki/` instead.
 
## AGENTS.md: The Complete Agent Specification
 
The `AGENTS.md` file is the single most important document in the repository. It is the file that GitHub-hosted agents, agentic CLI tools, GitHub Actions workflows, and any other automated process reads first when it encounters this repository. 
 
The file opens with a non-negotiable preamble that instructs any agent encountering the repository to stop and read the file completely before taking any action. This is the architectural guarantee that makes the system self-documenting: the repository itself carries the complete specification for how to operate on it.
 
### Repository Role and Core Mandate
 
The opening section establishes the conceptual model precisely. `/raw/` is the unprocessed source-material inbox. `/wiki/` is the curated knowledge base. The agent's responsibility is to transform material from `/raw/` into a structured, cross-linked, maintainable Markdown knowledge base in `/wiki/`. The core mandate is stated as a numbered list: open and inspect the repository; read relevant materials in `/raw/`; build, maintain, and improve a coherent knowledge base in `/wiki/`; create, update, reorganize, and cross-link Markdown notes in `/wiki/`; commit and push changes back to the repository when changes are made; and when asked questions, answer using `/wiki/` first.
 
### Boundary Rules: What Agents Must Never Touch
 
`AGENTS.md` specifies three zones that are completely off-limits to agents, and the specificity of these prohibitions is what makes them enforceable.
 
`/raw/` is strictly read-only. Agents must never modify, delete, rename, move, or create files in `/raw/`. All synthesis, editing, organization, and authored content must go into `/wiki/`. The source inbox is preserved exactly as it was received.
 
`.obsidian/` is managed exclusively by Obsidian and must not be modified by agents, with one precisely stated exception: `.obsidian/github-sync-metadata.json` must be updated whenever an agent creates, modifies, renames, or deletes any file outside of Obsidian. No other file inside `.obsidian/` may be touched under any circumstances.
 
`/.trash/` is managed exclusively by Obsidian offline and must be left entirely alone. Agents must not read, modify, delete, or create files in `/.trash/`, and must ignore its contents entirely during all operations. This directory accumulates files that Obsidian has soft-deleted, and any agent interaction with it could corrupt Obsidian's delete state.
 
### Quick Start Workflow
 
For any agent starting a session against this repository, `AGENTS.md` provides a numbered quick-start workflow that specifies exactly what to do and in what order. Open the repository; read `AGENTS.md` completely; inspect the current structure and contents of `/wiki/`; inspect relevant material in `/raw/`; decide what should be created, updated, merged, linked, or reorganized in `/wiki/`; apply changes in `/wiki/` only; commit and push the changes; and if a question was asked, answer it using the curated knowledge in `/wiki/`.
 
The sequencing is intentional. Reading the existing wiki structure before making any changes prevents agents from creating duplicate pages, overwriting useful content, or restructuring areas that are already well-organized.
 
### Operational Rules: Synthesis, Not Mirroring
 
A critical section of `AGENTS.md` specifies how agents should treat source material. The wiki is a curated layer, not a verbatim mirror of `/raw/`. Agents are expected to synthesize, summarize, normalize, deduplicate, and organize source material rather than transcribing it. They should prefer updating existing canonical notes over creating duplicates, and should create new notes when a topic clearly deserves its own page. Existing wiki content should be preserved unless it is redundant, obsolete, inaccurate, or clearly inferior to better source material.
 
The rules also require maintaining factual nuance and uncertainty. Agents must not overstate claims found in source materials. If source materials conflict, the disagreement must be explicitly noted rather than silently resolved. If a source is incomplete, fragmented, or ambiguous, the uncertainty must be marked in the resulting wiki page rather than smoothed over.
 
### Organization Requirements
 
`AGENTS.md` specifies that `/wiki/` must be organized into clear, intuitive, scalable topical categories expressed as high-level directories with meaningful subdirectories. The wiki must never be a flat dump of loose notes at its top level. Related notes must be grouped under shared parent directories, with finer topics nested beneath broader domains. New top-level categories should be introduced when they have earned their place, and subdirectories should be split further as a topic grows.
 
The file explicitly names the page types that should be maintained where appropriate: overview pages, topic pages, concept and reference pages, project pages, people pages, hub and index pages, and chronology or notes pages. Category and hub pages should be created when they improve navigation. Filenames should be stable and human-readable. The guiding principle is a small number of well-maintained canonical pages over many fragmented or overlapping notes.
 
Reorganization is permitted and encouraged when it improves hierarchy, clarity, or navigability, but specifically prohibited when it is cosmetic or churns structure for its own sake. The instruction is direct: do not degrade a well-organized area with unnecessary restructuring.
 
### Linking and Navigation
 
`AGENTS.md` requires that agents use Obsidian wikilinks extensively and meaningfully:
 
```
[[Page Name]]
```
 
Every wiki note should connect related ideas across the vault. "Related" or "See also" sections should be added where useful. Large blocks of content should be linked rather than duplicated. Each page should fit meaningfully into the larger structure, and hub pages should be created when they improve discoverability.
 
### Formatting Expectations
 
All authored content must be Markdown only, clearly titled, readable and well-structured, concise but sufficiently specific, and polished rather than raw. Headings should be used when they improve structure, bullet points when they improve clarity, and tables only when they are genuinely useful. Pages should begin with a short summary when appropriate. Generic filler summaries that erase important details are explicitly prohibited.
 
### Document Ingestion Protocol
 
When a new document appears in `/raw/` or an agent is asked to ingest a document, `AGENTS.md` specifies a complete ingestion protocol. Read the document fully before making any changes. Identify content that maps to existing wiki pages and merge or enrich those pages rather than duplicating them. Create new wiki pages when a topic is substantial enough to deserve its own page. Reorganize files and directory structures when the new content warrants it, for example by introducing a new subdirectory if a category of content has grown, or renaming pages, or moving pages between directories. Update all hub and index pages to reflect any new pages created or any structural changes made. Cross-link newly created or updated pages into related pages using Obsidian wikilinks. Update `.obsidian/github-sync-metadata.json` for every file created or modified, following the SHA computation protocol. Commit and push all changes atomically when the ingestion is complete.
 
### Wiki Linter: A Built-In Maintenance Agent Task
 
One of the more distinctive features of `AGENTS.md` is a detailed specification for a wiki linter, a maintenance agent task that audits and repairs the vault's structural integrity, link validity, and metadata completeness. The linter is described as a seven-step workflow that any agent can execute.
 
Step 1 identifies the vault metadata JSON file by checking the standard locations for community plugins before proceeding. Step 2 recursively enumerates all vault files, including those in `.trash/`, building complete lists of markdown files and non-markdown assets. Step 3 scans every markdown file for internal Obsidian wikilinks and standard relative markdown links, resolves each link against the full file list using Obsidian's resolution rules (case-insensitive match on filename without extension, shortest-path-wins for ambiguous names), and classifies each as valid, broken due to file not found, broken due to ambiguity, or broken due to a missing heading. Broken links are repaired according to a precisely specified strategy: links with no plausible near-match have their syntax removed with an inline comment; links with a near-match (edit distance of 2 or less on the base filename) have the target corrected with an inline comment; broken heading links have the fragment removed while the file link is preserved.
 
Step 4 audits the metadata JSON for completeness, verifying that every markdown file has a corresponding entry with all required fields. Missing entries are synthesized using the existing schema as a template, populated from the file's YAML frontmatter and filesystem timestamps where available. Step 5 validates the metadata JSON for well-formedness: valid JSON with no trailing commas or comments, all path keys using forward slashes, all date fields in ISO 8601 format, no raw newlines within string values, and UTF-8 encoding without BOM.
 
Step 6 updates `AGENTS.md` itself and its metadata entry to reflect the current UTC datetime, so that Obsidian Sync recognizes the file as modified and pulls the updated version on the next sync. Step 7 writes a linting report file to the repository root with a full summary of findings, broken links, metadata gaps, items requiring manual review, and files modified during the run.
 
The linter's execution rules are notable for their conservatism: every file write is preceded by a diff against the current content, and the file is not written if the diff is empty. Ambiguous or destructive repairs, such as removing more than a link fragment, are flagged for manual review rather than applied automatically. The linter never modifies any file in `.obsidian/` except the metadata JSON, and if running in an environment without write access it produces a dry-run diff report instead of writing files.
 
### Question-Answering Mode
 
`AGENTS.md` specifies how agents should behave when asked a question and told to use the vault. They must open the repository and read `/wiki/` first as the primary and authoritative curated knowledge source. `/raw/` is consulted only to fill gaps, verify details, or incorporate newly added material not yet reflected in `/wiki/`. If `/wiki/` is incomplete or outdated relative to `/raw/`, the agent should update `/wiki/` first when appropriate, before answering the question.
 
This sequencing, wiki first and raw as a fallback rather than a primary source, is what makes the curated knowledge base progressively more valuable over time. Each question that exposes a gap is an opportunity to improve the wiki before answering.
 
## LLMMEMORIES.md: Cross-Platform Persistent Memory
 
`LLMMEMORIES.md` is the canonical record of persistent user context. It is structured as a Markdown document with clearly delineated sections covering identity and roles, academic credentials, teaching responsibilities, research background, active funded projects, collaborators, and working preferences.
 
The key design principle, stated explicitly in `AGENTS.md`, is that this file is bidirectionally synchronized. When an AI system forms a more accurate or more detailed picture of some aspect of your context through extended interaction, that updated understanding should be written back into `LLMMEMORIES.md`. When `LLMMEMORIES.md` is updated in the repository, any agent starting a new session should read the new version and treat it as authoritative. The file is, in effect, an externalized, version-controlled memory store that persists across tools, sessions, and platforms.
 
When starting any session, `AGENTS.md` instructs agents to read both `LLMMEMORIES.md` and `SYSTEMPROMPT.md` and treat them as authoritative context alongside `AGENTS.md` itself.
 
## SYSTEMPROMPT.md: Twelve Sections of Standing Instructions
 
`SYSTEMPROMPT.md` captures the behavioral and stylistic instructions that would otherwise need to be pasted into the system prompt or custom instructions field of each tool individually. It is organized into twelve numbered sections.
 
**Section 1: Identity and Role Context** establishes professional identity and secondary identities relevant to task framing, including domain-specific calibration instructions. The purpose is not to describe the person to themselves but to give AI tools enough context to calibrate depth, vocabulary, and framing automatically without requiring re-explanation each session.
 
**Section 2: Communication and Output Style** covers prose and academic writing, email and correspondence, and document formatting. Academic writing uses complex and compound-complex sentences with commas, a challenges-first structure, first-person plural ("we") for academic contexts, hedging by scope condition rather than weakened claims, precise technical vocabulary, and lists framed by prose. The prohibition on em dashes is explicit: they must be replaced with commas, subordinate clauses, or restructured sentences. Email style is short, direct, and warm, opening with "Hi [Name]!" and closing with "Bill", committing rather than hedging, and appropriate for mild humor in familiar professional contexts.
 
**Section 3: Technical and Coding Preferences** specifies exception handling conventions (print with a location-specific prefix string plus `traceback.print_exc()`, never silently swallow exceptions), a requirement to provide complete revised function definitions rather than partial snippets or ellipsis-truncated fragments, a preference for externalizing all configuration into JSON files with configurable logging levels, a preferred technical stack for ML and pipeline work, and instructional code conventions that interleave mathematical derivations and conceptual explanations with implementation.
 
**Section 4: Task Execution Behavior** covers three sub-protocols. Before starting any task, an agent must read any `context/` or `ABOUT-ME/` directory, any `SYSTEM-RULES.md` or `HOW-I-WORK.md` file, and any project-specific subfolder or template that applies to the task. The clarification protocol prohibits beginning execution if the goal, intended audience, output format, or scope is ambiguous in ways that would materially affect the output. Output discipline requires stating assumptions explicitly and flagging uncertainty inline rather than omitting it.
 
**Section 5: Domain-Specific Standing Instructions** covers machine learning and AI (maintaining precision with probabilistic claims and applying existing pipeline architecture by default), computer science education and SoTL (grounding pedagogical recommendations in literature and noting evidentiary basis), grant and sponsored research writing (active voice, outcome-oriented framing, explicit distinctions between completed and proposed work), aviation and drone operations (applying FAA regulatory context from 14 CFR Parts 61, 91, and 107 as appropriate), and amateur radio (applying ITU and FCC Part 97 context, distinguishing between amateur and emergency communication contexts).
 
**Section 6: Memory and Context Hygiene** addresses the stateless nature of many AI sessions. Workspace folder context files are the authoritative persistent memory, not inferred prior session context. If a task produces information that should persist across sessions, the instruction is to suggest saving it to the appropriate context file and offer to do so.
 
**Section 7: General Constraints** includes an absolute prohibition on hallucinating citations, a requirement to prefer depth and accuracy over speed, and a constraint against producing outputs that could be mistaken for official institutional communication without explicit authorization.
 
**Section 8: Confirmation Gates** is the section with the most direct operational consequence for agentic use. It defines six categories of action that require explicit affirmative confirmation before execution, and specifies precisely what information must be displayed when requesting that confirmation. A general instruction to "go ahead and handle everything" explicitly does not constitute confirmation for any of these categories.
 
Gate 8.1 covers destructive or significant file system alterations: deleting any file or directory, overwriting any existing file (with a requirement to propose a versioned backup first), renaming or moving more than three files in bulk, modifying any file outside the active workspace folder, or clearing a database. Gate 8.2 covers external communications: sending any email or message via any connected service. Drafting is permitted without confirmation; sending is not. Gate 8.3 covers version control actions: committing to any repository, pushing to any branch including feature branches, creating or deleting or merging branches, tagging a release, or force-pushing (the last of which is additionally flagged as high-risk). Gate 8.4 covers web and cloud publishing: deploying web content, updating live pages or API endpoints, uploading to publicly accessible cloud storage, submitting forms or proposals, or modifying DNS or SSL configuration. Gate 8.5 covers financial, administrative, and credentialed actions: financial transactions, institutional system access, grant portal submissions, or anything generating a binding commitment on the user's behalf. Gate 8.6 establishes a threshold for batch operations: any automated operation affecting more than five files, records, or API calls in a single execution requires confirmation before the batch runs, with a display of the first two or three operations so the pattern can be verified.
 
**Section 9: Plan-First Protocol** requires that for any task involving more than three discrete steps, or touching more than one confirmation gate category, a written execution plan must be presented before any action is taken. The plan must include a numbered list of all steps in sequence, the tool or method and expected output for each step, an explicit list of any confirmation gates that will be triggered and at which step, and an explicit request for approval before Step 1 executes.
 
**Section 10: Sensitive Data Handling** establishes FERPA-based handling requirements for student data (no transmission, caching, or summarization of student records outside the local workspace without explicit authorization), IRB-based handling requirements for human subjects research data (flag any task appearing to involve such data and request confirmation of the applicable IRB protocol before proceeding), and a general prohibition on logging or outputting API keys, passwords, OAuth tokens, or unpublished grant narratives.
 
**Section 11: Task Logging and Audit Trail** requires appending a session log to `logs/session_log.md` at the conclusion of any session in which files were created, modified, sent, or published. The log entry must include the date and time, a one-paragraph plain-English summary of what was accomplished, a list of files created or modified with their paths, a list of any external actions taken with confirmation that each was explicitly authorized, and any open items or follow-up tasks identified during the session.
 
**Section 12: Escalation and Uncertainty Protocol** is the most operationally important safety instruction for autonomous use. If at any point during execution an agent encounters a situation not covered by the instructions, a conflict between two instructions, an unexpected error or permission failure or ambiguous system state, or a result that does not match the expected output, the instruction is to stop execution immediately, report the situation clearly, and wait for guidance. Autonomous recovery from unexpected states by taking additional actions is explicitly prohibited. The protocol frames this as a cost-benefit argument: the cost of pausing is always lower than the cost of an unintended irreversible action.
 
## Connecting AI Systems to the Vault
 
The practical integration pattern differs by tool type, but the underlying idea is the same in every case: give the tool a path to `AGENTS.md`, `LLMMEMORIES.md`, and `SYSTEMPROMPT.md`, and let those files do the context-setting work.
 
For **agentic CLI tools** like Claude Code and OpenCode, the integration is a `CLAUDE.md` or `AGENTS.md` file at the root of each project that begins with a fetch-and-read instruction pointing at the vault repository:
 
```markdown
## Context
 
Before beginning any task, fetch and read the following files from the
knowledge repository:
 
- https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/Obsidian-Vault/main/AGENTS.md
- https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/Obsidian-Vault/main/LLMMEMORIES.md
- https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/Obsidian-Vault/main/SYSTEMPROMPT.md
 
Treat the contents of those files as authoritative context for all decisions
in this session.
```
 
For **GitHub Actions workflows**, the vault repository is checked out as a secondary input in the workflow definition:
 
```yaml
- name: Checkout knowledge vault
  uses: actions/checkout@v4
  with:
    repository: YOUR_GITHUB_USERNAME/Obsidian-Vault
    token: ${{ secrets.VAULT_PAT }}
    path: vault
 
- name: Build context
  run: |
    cat vault/AGENTS.md vault/LLMMEMORIES.md vault/SYSTEMPROMPT.md > /tmp/context.md
```
 
For **web-based assistants** with a custom instructions field, I maintain a condensed version of `SYSTEMPROMPT.md` in that field, with a reference to the full repository for agents that can fetch URLs. The condensed version covers the highest-impact sections: identity, writing style, confirmation gates, and the location of the canonical files.
 
For **local containerized agents**, the vault directory is bind-mounted directly into the container's filesystem:
 
```bash
docker run --rm -it \
  -v "$HOME/obsidian-vault:/vault:ro" \
  -v "$HOME/projects/current:/workspace" \
  my-agent:latest
```
 
The `:ro` flag applies when the local agent is consuming context rather than writing wiki content. For agents whose primary job is to write to `/wiki/`, the mount is read-write, and the agent commits its changes through the GitHub REST API so that the metadata protocol is satisfied correctly. Thanks to the system prompt details about updating the Github Gitless Sync plugin metadata json file, this is optional, and agents can also modify the repository to be synchronized back to Obsidian. In this way, I really only use Obsidian as a convenient viewer.
 
## A Concrete Example: Your CV as a Raw Source
 
The most direct way to see how the write path works is to walk through the simplest possible workflow: drop a document into `raw/`, point an agent at the repository, and watch it process the document into `wiki/`.
 
Suppose you drop a PDF CV into `raw/`:
 
```
raw/
└── my-cv.pdf
```
 
You then give an agentic tool the following instruction, which is all it needs because the rest is specified in `AGENTS.md`:
 
```
Clone https://github.com/YOUR_GITHUB_USERNAME/Obsidian-Vault, read AGENTS.md,
and follow the instructions to process any unprocessed documents in raw/.
```
 
The agent reads `AGENTS.md`, which tells it that `raw/` is a read-only inbox, that processed content belongs in `wiki/`, and that it must update `.obsidian/github-sync-metadata.json` for every file it creates. It then reads the CV, extracts the relevant structured information, and builds out the wiki accordingly, creating pages for education, positions held, publications, funded projects, skills, and service roles, cross-linking them to each other and to an `index.md` hub. It commits the new wiki files and the updated metadata back to the repository in a single atomic commit.
 
The next time you open Obsidian and trigger a sync, those wiki pages appear in your vault as fully navigable, cross-linked notes. The CV has been processed exactly once, its information now lives in a structured and queryable form, and the original PDF is preserved untouched in `raw/`.
 
The same workflow applies to any source material: a conference paper, a project brief, a set of meeting notes exported from another application, a transcript, a published technical document. Whatever arrives in `raw/` becomes an input to the next agent run, which extends the wiki without touching anything that already exists. Over time, the wiki accumulates a comprehensive, cross-linked knowledge base built from actual documents, maintained by agents that follow the same explicit instructions every time.
 
## The Wiki as a Queryable Knowledge Base
 
The `wiki/` directory is the output of the system, the structured knowledge base that gets built and maintained over time. Its organization should reflect the categories of information it needs to represent. `AGENTS.md` specifies that the wiki must be organized into clear, intuitive, scalable topical categories with high-level directories and meaningful subdirectories, never left as a flat dump of loose notes at its top level.
 
The `wiki/index.md` serves as the hub for the entire knowledge base. When an agent is asked a question and instructed to use the vault, `AGENTS.md` specifies that it starts at `wiki/index.md`, identifies the relevant area, navigates to the appropriate subdirectory, reads the relevant files, and synthesizes an answer, updating the wiki first if it is incomplete or outdated relative to available source material in `raw/`.
 
This sequence, hub to subdirectory to relevant pages to synthesis, is the same workflow a human would follow when using Obsidian, which makes the agent behavior predictable and auditable. The wiki is structured for both human navigation and machine traversal, because those two requirements are compatible when the underlying format is plain Markdown with explicit cross-links.
 
## The raw/ Inbox and Reference Cataloging
 
The `raw/` directory handles a problem that anyone who works across multiple document formats encounters regularly: you receive a PDF, or an exported summary, or a transcript, and you need to incorporate the information into your knowledge base without losing the original source. The `raw/` inbox holds originals in whatever format they arrive, and they are never modified.
 
The non-destructive contract of `raw/` means that the inbox can grow without risk. A new document dropped into `raw/` will be picked up on the next agent run and incorporated into the wiki, while the original is preserved for future reference or re-processing. When an agent creates a wiki note from a source document, it links back to the original in `raw/` using a relative wikilink:
 
```markdown
*Source: [[../raw/my_cv.pdf]]*
```
 
Obsidian renders this as a clickable link that opens the original document; an agent resolves it as a vault-relative path. This citation chain means that every wiki page can be traced back to its source, and the source can be re-processed with a better agent or a different prompt without losing either the original document or the previously generated wiki content.
 
## Synchronization in Practice
 
The full synchronization cycle, from a local Obsidian edit to an agent seeing the change, involves three steps: edit in Obsidian, trigger a sync via the Gitless Sync plugin, and have the agent pull from the GitHub API or clone the repository fresh. The reverse cycle, from an agent commit to Obsidian seeing the change, is: agent writes to GitHub via the REST API, updating metadata correctly in the same atomic commit; Obsidian pulls on the next sync; and the new or modified file appears in the vault.
 
The metadata protocol is what makes the reverse cycle work reliably. An agent that creates files without updating the metadata will find that those files appear to Obsidian as if they were created outside the sync system and may not be pulled on the next sync. An agent that updates metadata with incorrect SHA values will trigger a spurious re-download of files that have not changed. The atomic commit requirement, where the file change and the metadata update land in the same commit, prevents a state where one exists without the other.
 
## Practical Takeaways
 
Running this system for the past year has produced a clear picture of what works and what requires ongoing attention. The three-file root structure (`AGENTS.md`, `LLMMEMORIES.md`, `SYSTEMPROMPT.md`) has proven to be the right level of granularity: enough separation to allow selective reading, not so much fragmentation that agents need to synthesize across many files to get a complete picture. The `raw/` read-only constraint has been invaluable; on two occasions, agents attempted to modify source documents, and the explicit prohibition in `AGENTS.md` was what stopped them. The bidirectional memory update convention for `LLMMEMORIES.md` is theoretically correct but requires discipline in practice: it is easy to accept a session's refined understanding and forget to write it back to the file.
 
The confirmation gate protocol in `SYSTEMPROMPT.md` has proven its value in agentic contexts most sharply. Having the protocol specified in a canonical file rather than per-tool configuration means that a GitHub Actions workflow, a local container running Claude Code, and a web-based assistant all inherit the same safety constraints automatically. The cost of reading the file is negligible; the cost of not having the protocol is an agent that commits, pushes, or deploys without checking first.
 
The setup cost is low. The vault structure requires perhaps two hours of initial authoring: writing `AGENTS.md`, writing an initial `LLMMEMORIES.md` from whatever context you already maintain elsewhere, and writing an initial `SYSTEMPROMPT.md` from the instructions you already paste into various tools. The return, in terms of consistent and well-calibrated AI assistance across tools and sessions, scales with the quality of those three files. The vault has become the single source of truth for the context that every AI tool I use draws from, and the discipline of maintaining it in one place is considerably less costly than the alternative of maintaining five inconsistent versions of the same information in five incompatible formats.
 
---
