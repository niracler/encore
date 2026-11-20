# Encore

Encore turns recorded AI Agent sessions into portable, interactive web replays with a live context-window inspector.

## Language

**Agent**:
The AI assistant environment whose session is captured and replayed, such as Codex, Claude Code, Claude.ai, or WorkBuddy.
_Avoid_: Tool (for the source environment), Client, Harness, Source

**Tool**:
A capability invoked by an Agent during a session, such as reading a file, editing code, or running a command; an individual invocation is a tool call.
_Avoid_: Action, Command (as the umbrella term)

**Adapter**:
A source-specific translator that turns one Agent's native log format into Encore's canonical session representation.
_Avoid_: Reader, Importer, Parser

**Raw Log**:
The native recording written or exported by an Agent before Encore normalizes it.
_Avoid_: Raw Transcript, Transcript, Rollout

**Session**:
Encore's canonical, Agent-independent record of a captured Agent run—the structured source edited during curation and consumed for playback.
_Avoid_: Transcript, Normalized Log

**Replay**:
A portable, publishable package of a Session together with its media and Player, ready to be opened or hosted standalone.
_Avoid_: Stage Replay, Bundle, Export

**Player**:
The interactive web component that renders a Session for playback and context inspection.
_Avoid_: Stage, Widget, Viewer

**Event**:
A single atomic occurrence recorded in a Session, such as a user message, assistant reply, reasoning block, tool call, or compaction.
_Avoid_: Item, Entry, Message (as the umbrella term)

**Step**:
The smallest playback unit of a Session—grouping one or more consecutive Events into a single advancement of the Player with its own context snapshot.
_Avoid_: Group, Chunk, Beat

**Playback Position**:
The last Step revealed in a Replay, or the starting position before the first Step. It determines the current Context Snapshot and which Step plays next.

**Turn**:
One complete cycle of collaboration initiated by a user message and spanning every Step until the next user message or the end of the Session.
_Avoid_: Prompt (for the whole cycle), Round, Exchange

**Sub-agent**:
A parallel Agent instance spawned by the primary Agent to handle delegated work and return a report within the same Session.
_Avoid_: Subtask, Worker, Child Agent, Lane

**Initial Context**:
The baseline context already loaded into an Agent's context window before the first Turn begins, such as system prompts, Tool schemas, memory rules, and skill definitions.
_Avoid_: Preamble, Mounted Context, Base Context

**Context Snapshot**:
The state of an Agent's context window before playback starts or at a specific Step, comprising its token usage, breakdown across Context Categories, and the Context Records present at that point.
_Avoid_: Active Context, Window State

**Context Category**:
One of the top-level groupings that partition a Context Snapshot—system prompts, Tool schemas, user messages, memory rules, skills, assistant replies, and Tool outputs.
_Avoid_: Bucket, Segment, Kind

**Context Record**:
A single inspectable unit of content inside a Context Category, such as one rule document, message, or Tool output.
_Avoid_: Context Item, Entry

**Compaction**:
A context-window boundary—triggered automatically near capacity, manually, or as a handoff—at which earlier messages and Tool outputs are archived to reclaim tokens while retaining core instructions, memory rules, and a structured summary.
_Avoid_: Compression, Truncation, Pruning

**Attachment**:
A file provided by the user alongside a message as input or reference material for the Agent, optionally packaged into the Replay for viewing.
_Avoid_: Input Deliverable, Message File

**Deliverable**:
A file produced and handed back by the Agent during or at the end of a Session—such as a report, spreadsheet, poster, or video—packaged into the Replay for inspection.
_Avoid_: Output File, Final File, Artifact

**Frame**:
A visual milestone image captured from a Session—either a user reference image or an Agent stage output—extracted and surfaced on Steps and the playback timeline.
_Avoid_: Stage Output, Screenshot, Milestone Image

**Asset Root**:
A permitted local directory boundary from which Encore may collect Attachments and Deliverables when packaging a Replay.
_Avoid_: Collection Directory, Source Root

**Redaction**:
The removal or replacement of sensitive information in a Session—spanning automatic hiding of credentials, local paths, and cross-session memory, plus manual removal of internal names or business data before publication.
_Avoid_: Sanitization, Masking, Scrubbing

**Leak Check**:
A non-blocking inspection of a Session that flags residual suspicious patterns—such as credentials, local paths, URL token parameters, or internal domains—before a Replay is shared.
_Avoid_: Secret Check, Privacy Scan, Privacy Check

**Curation**:
The editorial refinement of a Session after initial export—selecting and labeling Frames, writing a title and introduction, trimming off-topic Turns, and removing domain-specific secrets before publishing a Replay.
_Avoid_: Polishing, Post-processing

**Rebuild**:
A pass over an existing Replay that refreshes its Player assets, previews, Frame references, and Leak Check results from the current Session without re-importing the Raw Log or overwriting Curation edits.
_Avoid_: Re-render, Re-sync, Re-export
