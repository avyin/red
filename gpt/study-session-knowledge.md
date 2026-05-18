# Study Session Log Knowledge

Study Session Log stores study sessions and concept memory from chat-based learning.

The product exists for users who learn through ChatGPT, Gemini, Claude, or another chat assistant and want to save a clean record of what they studied plus a durable map of what they currently know.

## Core Concept

A study session is a single learning interaction.

A concept is a durable unit of knowledge. A session answers "what happened in this interaction?" A concept answers "what does the student currently know, and what state is it in?"

It starts when the user begins studying a topic and ends when the user asks to save, log, or end the session.

It can also be paused when the user wants to take a break without completing the session. A paused session can later be resumed and completed.

The saved record should represent the learning session, not every message in the conversation.

The app should not persist every conversational turn. It should batch useful updates at natural checkpoints such as start, pause, save, end of topic, review completed, "update my map", and "what should I study next?"

## Data Model

Each study session has:

- `id`: unique session ID
- `topic`: optional short title or topic
- `summary`: optional plain text summary of what the user studied or learned
- `source`: optional source such as `chatgpt`, `gemini`, `claude`, a course, a book, a website, or `null`
- `startedAt`: server timestamp for when the session began
- `pausedAt`: server timestamp for when the session was paused, or `null` while active or completed
- `endedAt`: server timestamp for when the session was saved or ended, or `null` while active
- `createdAt`: record creation timestamp
- `updatedAt`: last update timestamp

Each concept has:

- `id`: unique concept ID
- `title`: short human-readable concept name
- `summary`: what the student currently understands about it
- `state`: one of `new`, `learning`, `review`, `stable`, or `stale`
- `lastStudiedAt`: when it was last touched in a study session
- `lastReviewedAt`: when the student last demonstrated recall or understanding
- `nextReviewAt`: optional suggested review time
- `createdAt`: record creation timestamp
- `updatedAt`: last update timestamp

Each concept evidence record has:

- `id`: unique evidence ID
- `conceptId`: concept the evidence belongs to
- `studySessionId`: optional session that caused the update
- `evidenceType`: short cause such as `study_session`, `review`, `user_explanation`, or `checkpoint`
- `note`: short explanation of the evidence
- `stateBefore`: optional previous concept state
- `stateAfter`: optional resulting concept state
- `createdAt`: evidence timestamp

Concept states mean:

- `new`: the concept has been introduced but not checked.
- `learning`: the user is actively working through it.
- `review`: the user has shown some understanding, but it should be checked again.
- `stable`: the user has demonstrated enough understanding for now.
- `stale`: the concept has not been reviewed recently and may need maintenance.

## Action Reference

- `startStudySessionPost`: starts an untitled active study session with a POST request and returns the server-generated `startedAt` timestamp. Prefer this for new automatic chat-session starts.
- `startStudySession`: backward-compatible GET start action. Use only if the POST action is unavailable.
- `listStudySessions`: returns study sessions newest first. Supports optional `search` and `status` values of `completed`, `active`, `paused`, or `all`.
- `getStudySession`: returns one study session by ID.
- `updateStudySession`: updates `topic`, `summary`, or `source`. Can set `endSession: true` to complete the session, `pauseSession: true` to pause it, or `resumeSession: true` to resume it.
- `deleteStudySession`: deletes one study session by ID.
- `listConcepts`: returns concepts newest by update time. Supports optional `search` and `state`.
- `createConcept`: creates a concept.
- `getConcept`: returns one concept by ID.
- `updateConcept`: updates title, summary, state, or review dates.
- `deleteConcept`: deletes one concept. This is destructive.
- `listConceptEvidence`: returns recent evidence for a concept.
- `recordConceptEvidence`: records one evidence item for a concept.
- `recordLearningCheckpoint`: batches a session update, concept updates, and evidence records in one action. Prefer this at pause, save, review completed, end of topic, "update my map", and "what should I study next?"

## Example Session

User starts:

```text
I am studying processes and threads.
```

The session topic could be:

```text
Processes and threads
```

When saved, the summary could be:

```text
A process is an isolated running program. A thread is an execution unit inside a process. Threads in the same process can share memory, while separate processes are isolated from each other.
```

The source could be:

```text
chatgpt
```

## Example Search Queries

- `thread`
- `TypeScript`
- `chatgpt`
- `async JavaScript`
- `calculus`

## Good Saved Summaries

Good summaries are:

- plain text
- concise
- standalone
- based only on what was discussed
- easy to scan later

Example:

```text
Async JavaScript lets work continue while waiting for slow operations. Promises represent future results, and async/await makes promise-based code read like step-by-step synchronous code.
```

## Poor Saved Summaries

Poor summaries are:

- too vague
- full of internal action details
- copied directly from a long chat without cleanup
- embellished with facts that were not discussed

Poor example:

```text
We talked about stuff and then I called updateStudySession with endSession true.
```
