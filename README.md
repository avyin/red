# Study Session Log

A tiny study-session journal for chat-based learning.

The app stores study sessions, not standalone notes. A session can start when a user begins learning in ChatGPT, Gemini, Claude, or another chat assistant. When the user asks to pause, the assistant marks the session paused so it can be resumed later. When the user asks to save or end the session, the assistant updates that session with a summary and completion timestamp.

## Setup

Requires Node.js 24 or newer.

```sh
pnpm install
cp .env.example .env
pnpm db:init
```

The database is created automatically if it does not exist. The default path is `./data/app.sqlite`.

## Run Locally

Start the API and Vite UI:

```sh
pnpm dev
```

Open the UI at:

```text
http://localhost:5173
```

The API runs on:

```text
http://localhost:3001
```

To run the built app from one server:

```sh
pnpm build
pnpm start
```

Then open:

```text
http://localhost:3001
```

## API Examples

Health check:

```sh
curl http://localhost:3001/health
```

Begin a study session:

```sh
curl -X POST http://localhost:3001/api/study-sessions
```

Begin a study session with the chat-friendly GET action:

```sh
curl http://localhost:3001/api/study-sessions/start
```

Begin a study session with a topic:

```sh
curl -X POST http://localhost:3001/api/study-sessions \
  -H 'Content-Type: application/json' \
  -d '{"topic":"Processes and threads","source":"chatgpt"}'
```

Save or end a study session:

```sh
curl -X PATCH http://localhost:3001/api/study-sessions/YOUR_SESSION_ID \
  -H 'Content-Type: application/json' \
  -d '{
    "topic": "Processes and threads",
    "summary": "A process is an isolated running program. A thread is an execution unit inside a process, and threads in the same process can share memory.",
    "source": "chatgpt",
    "endSession": true
  }'
```

Pause a study session:

```sh
curl -X PATCH http://localhost:3001/api/study-sessions/YOUR_SESSION_ID \
  -H 'Content-Type: application/json' \
  -d '{"pauseSession":true}'
```

Resume a paused study session:

```sh
curl -X PATCH http://localhost:3001/api/study-sessions/YOUR_SESSION_ID \
  -H 'Content-Type: application/json' \
  -d '{"resumeSession":true}'
```

Create a completed study session manually:

```sh
curl -X POST http://localhost:3001/api/study-sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "topic": "OpenAPI actions",
    "summary": "ChatGPT Actions use an OpenAPI schema, and the server should provide timestamps rather than relying on the chat client.",
    "source": "chatgpt",
    "endSession": true
  }'
```

List study sessions:

```sh
curl http://localhost:3001/api/study-sessions
```

List active study sessions:

```sh
curl 'http://localhost:3001/api/study-sessions?status=active'
```

List paused study sessions:

```sh
curl 'http://localhost:3001/api/study-sessions?status=paused'
```

Search study sessions:

```sh
curl 'http://localhost:3001/api/study-sessions?search=thread'
```

Get one study session:

```sh
curl http://localhost:3001/api/study-sessions/YOUR_SESSION_ID
```

Update a study session:

```sh
curl -X PATCH http://localhost:3001/api/study-sessions/YOUR_SESSION_ID \
  -H 'Content-Type: application/json' \
  -d '{"summary":"Updated summary.","source":"chatgpt"}'
```

Delete a study session:

```sh
curl -X DELETE http://localhost:3001/api/study-sessions/YOUR_SESSION_ID
```

OpenAPI YAML:

```sh
curl http://localhost:3001/openapi.yaml
```

## Chat UX

The assistant should not open with a big menu. A menu makes the workflow feel like a form, but the value is that the user can learn naturally in chat.

Recommended opening:

```text
Tell me what you are studying. I will keep track in the background, and when you say "save this session" I will store a clean summary.
```

Good conversation starters:

```text
I am studying processes and threads.
```

```text
Help me understand async JavaScript, then save the session.
```

```text
What study sessions have I saved about TypeScript?
```

```text
Save this as a study session.
```

Action workflow for a chat assistant:

1. When the user starts a study-like interaction, call `startStudySession` with no arguments.
2. Keep the returned `id` in conversation context.
3. Teach, discuss, ask questions, or help the user refine their understanding.
4. When the user says to pause or take a break, call `updateStudySession` with `pauseSession: true`. Optionally include a short progress `summary`.
5. If the user clearly continues the same study topic in the same conversation, call `updateStudySession` with `resumeSession: true` before continuing. If the intent is ambiguous, ask whether they want to continue the paused session.
6. In a new conversation, when the user asks to continue or pick up where they left off, call `listStudySessions` with `status=paused` and resume the clear match. Ask the user to choose if there are multiple plausible paused sessions.
7. When the user says to save, log, or end the session, infer the final `topic` and `summary` from the conversation and call `updateStudySession` with `topic`, `summary`, `source`, and `endSession: true`.
8. Confirm briefly that the study session was saved.

## Ngrok

Run the built app or dev API on port 3001, then expose it:

```sh
ngrok http 3001
```

Use the ngrok URL for ChatGPT Actions:

```text
https://your-ngrok-url/openapi.yaml
```

Set `PUBLIC_BASE_URL` in `.env` to your ngrok URL so the OpenAPI server URL matches:

```env
PUBLIC_BASE_URL=https://your-ngrok-url
```

## Environment

```env
PORT=3001
DATABASE_URL=./data/app.sqlite
PUBLIC_BASE_URL=http://localhost:3001
```
