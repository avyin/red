# Study Session Log Knowledge

Study Session Log stores study sessions from chat-based learning.

The product exists for users who learn through ChatGPT, Gemini, Claude, or another chat assistant and want to save a clean record of what they studied.

## Core Concept

A study session is a single learning interaction.

It starts when the user begins studying a topic and ends when the user asks to save, log, or end the session.

The saved record should represent the learning session, not every message in the conversation.

## Data Model

Each study session has:

- `id`: unique session ID
- `topic`: optional short title or topic
- `summary`: optional plain text summary of what the user studied or learned
- `source`: optional source such as `chatgpt`, `gemini`, `claude`, a course, a book, a website, or `null`
- `startedAt`: server timestamp for when the session began
- `endedAt`: server timestamp for when the session was saved or ended, or `null` while active
- `createdAt`: record creation timestamp
- `updatedAt`: last update timestamp

## Action Reference

- `beginStudySession`: creates a study session and returns the server-generated `startedAt` timestamp.
- `startStudySession`: starts an untitled active study session with a GET request and returns the server-generated `startedAt` timestamp. It takes no arguments. Prefer this for automatic chat-session starts.
- `listStudySessions`: returns study sessions newest first. Supports optional `search`.
- `getStudySession`: returns one study session by ID.
- `updateStudySession`: updates `topic`, `summary`, or `source`. Can set `endSession: true` to complete the session.
- `deleteStudySession`: deletes one study session by ID.

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
