# Codex Implementation Prompt

You are working in the `study-session-log` app. Read `docs/app-decisions.md` first and implement the next version of the app according to those decisions.

## Goal

Evolve the app from a simple study-session logger into the first version of a personal learning-memory system.

The Custom GPT remains the primary interface. The web UI is an admin/history view. The app is personal-only for now and does not need authentication in this MVP.

## Product Requirements

Implement a simple concept layer alongside the existing study-session layer.

A concept is the durable unit of knowledge. A study session is a temporary learning event. Sessions answer "what happened in this interaction?" Concepts answer "what does the student currently know, and what state is it in?"

The initial concept model should support:

- `id`
- `title`
- `summary`
- `state`
- `lastStudiedAt`
- `lastReviewedAt`
- `nextReviewAt`
- `createdAt`
- `updatedAt`

The initial concept states are:

- `new`
- `learning`
- `review`
- `stable`
- `stale`

Add a way to record lightweight evidence for concept state changes. Evidence should connect a concept update to what caused it, such as a study session, review, user explanation, or GPT-observed checkpoint. Keep this simple. Do not build a complex mastery system yet.

## GPT / Action Workflow Requirements

The user must initiate study. The GPT should only start tracking after the user's first study-related message.

Avoid duplicate sessions. Once the GPT starts or resumes a session, it should keep that session ID in conversation context and update that same record instead of creating another one.

Avoid frequent mutating writes. Because Custom GPT actions can require approval, the API and GPT instructions should encourage batched updates at natural checkpoints:

- start
- pause
- save
- end of topic
- review completed
- "update my map"
- "what should I study next?"

Do not design the system to persist every conversational turn.

Long-term, starting a session should not rely on a mutating GET. Add a cleaner write endpoint for starting a session, likely `POST /api/study-sessions/start` or an equivalent action-friendly endpoint. Keep the existing GET endpoint if needed for backward compatibility, but prefer the POST endpoint in docs and OpenAPI.

## API Requirements

Keep the existing study-session endpoints working.

Add concept endpoints that support:

- list concepts, optionally filtered by `state` and/or search text
- create concept
- get one concept
- update concept
- delete concept
- record concept evidence or concept update

Add a checkpoint/batch endpoint if it fits the existing codebase better than many small concept calls. The useful shape is an endpoint the GPT can call at save/pause/review time to update a session and multiple concepts in one approval.

Update OpenAPI so the Custom GPT can use the new concept and batch/checkpoint actions.

For action safety, document which operations are low-risk logging updates and which are destructive. Keep delete operations explicit.

## UI Requirements

Keep the UI quiet and admin-focused.

Add a concepts/history view that lets the user:

- see concepts and their states
- filter concepts by state
- search concepts
- open a concept detail view
- edit concept title, summary, state, review dates if present
- inspect recent evidence for a concept

The UI does not need to become the primary learning experience.

## GPT Docs Requirements

Update the GPT instruction files under `gpt/` so the Custom GPT understands:

- the student starts naturally in chat
- start or resume only after the first study-related user message
- do not start duplicate sessions
- teach in small loops: explain -> ask -> user answers -> correct/refine -> practice -> summarize
- update concepts only when there is evidence
- batch persistence at natural checkpoints
- use concept states to decide review behavior

Update README examples for the new concept and checkpoint workflows.

## Constraints

Keep the implementation pragmatic and small. Do not add:

- multi-user accounts
- authentication
- complex spaced repetition algorithms
- embeddings/vector search
- visual graph rendering
- mastery scores
- prerequisite graph logic
- background jobs
- per-message transcript storage

Use the existing stack and patterns: TypeScript, Express, React, Vite, and Node `node:sqlite`.

Preserve existing data. Add migrations for new tables/columns.

## Suggested Data Model

Use this as a starting point, but adapt to the existing codebase:

```text
concepts
- id TEXT PRIMARY KEY
- title TEXT NOT NULL
- summary TEXT
- state TEXT NOT NULL
- lastStudiedAt TEXT
- lastReviewedAt TEXT
- nextReviewAt TEXT
- createdAt TEXT NOT NULL
- updatedAt TEXT NOT NULL

concept_evidence
- id TEXT PRIMARY KEY
- conceptId TEXT NOT NULL
- studySessionId TEXT
- evidenceType TEXT NOT NULL
- note TEXT
- stateBefore TEXT
- stateAfter TEXT
- createdAt TEXT NOT NULL
```

Optional relationship table if it stays simple:

```text
concept_relations
- id TEXT PRIMARY KEY
- sourceConceptId TEXT NOT NULL
- targetConceptId TEXT NOT NULL
- relationType TEXT
- createdAt TEXT NOT NULL
```

Only add `concept_relations` if it does not make the first implementation too large.

## Verification

Run:

```sh
pnpm typecheck
pnpm build
```

If practical, manually smoke-test:

- create a study session
- pause/resume/end a study session
- create a concept
- update concept state
- add evidence to a concept
- list concepts by state
- fetch OpenAPI YAML and verify it includes the new actions

## Deliverable

Make the code changes, update docs, and summarize:

- changed files
- new API endpoints
- migration/data model changes
- verification results
- any intentionally deferred items
