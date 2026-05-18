# Study Session Log

A tiny personal learning-memory system for chat-based learning.

The app stores study sessions and concepts. A session is a temporary learning event: it starts when a user begins learning in ChatGPT, Gemini, Claude, or another chat assistant. A concept is a durable knowledge-map entry: it tracks what the student currently understands and what state that knowledge is in. When the user asks to pause, save, finish a topic, complete a review, or update their map, the assistant can batch session, concept, and evidence updates.

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

Begin a study session with the preferred write action:

```sh
curl -X POST http://localhost:3001/api/study-sessions/start
```

Create a study session with the general endpoint:

```sh
curl -X POST http://localhost:3001/api/study-sessions
```

Begin a study session with the backward-compatible GET action:

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

Create a concept:

```sh
curl -X POST http://localhost:3001/api/concepts \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "JavaScript promises",
    "summary": "Promises represent future results from asynchronous work.",
    "state": "learning",
    "lastStudiedAt": "2026-05-18T18:00:00.000Z"
  }'
```

List concepts by state:

```sh
curl 'http://localhost:3001/api/concepts?state=review'
```

Search concepts:

```sh
curl 'http://localhost:3001/api/concepts?search=promise'
```

Get one concept:

```sh
curl http://localhost:3001/api/concepts/YOUR_CONCEPT_ID
```

Update a concept state:

```sh
curl -X PATCH http://localhost:3001/api/concepts/YOUR_CONCEPT_ID \
  -H 'Content-Type: application/json' \
  -d '{"state":"review","nextReviewAt":"2026-05-25T18:00:00.000Z"}'
```

Record evidence for a concept:

```sh
curl -X POST http://localhost:3001/api/concepts/YOUR_CONCEPT_ID/evidence \
  -H 'Content-Type: application/json' \
  -d '{
    "studySessionId": "YOUR_SESSION_ID",
    "evidenceType": "user_explanation",
    "note": "The user explained that a promise is a placeholder for a future async result.",
    "stateBefore": "learning",
    "stateAfter": "review"
  }'
```

List concept evidence:

```sh
curl http://localhost:3001/api/concepts/YOUR_CONCEPT_ID/evidence
```

Record a learning checkpoint:

```sh
curl -X POST http://localhost:3001/api/learning-checkpoints \
  -H 'Content-Type: application/json' \
  -d '{
    "studySessionId": "YOUR_SESSION_ID",
    "session": {
      "summary": "The user practiced promises and explained future async results.",
      "pauseSession": true
    },
    "concepts": [
      {
        "title": "JavaScript promises",
        "summary": "Promises represent future results from asynchronous work.",
        "state": "review",
        "lastStudiedAt": "2026-05-18T18:00:00.000Z",
        "nextReviewAt": "2026-05-25T18:00:00.000Z",
        "evidence": {
          "evidenceType": "checkpoint",
          "note": "The user correctly explained the basic promise model."
        }
      }
    ]
  }'
```

Delete a concept:

```sh
curl -X DELETE http://localhost:3001/api/concepts/YOUR_CONCEPT_ID
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

1. When the user starts a study-like interaction, call `startStudySessionPost`.
2. Keep the returned `id` in conversation context.
3. Do not start duplicate sessions in the same conversation unless the topic clearly changes, the user asks to start something new, or the prior session ended.
4. Teach in small loops: explain, ask, let the user answer, correct or refine, practice, summarize.
5. Do not persist every conversational turn. Batch persistence at natural checkpoints.
6. When the user says to pause or take a break, call `recordLearningCheckpoint` if concept updates are useful, or `updateStudySession` with `pauseSession: true` if only pausing.
7. If the user clearly continues the same study topic in the same conversation, call `updateStudySession` with `resumeSession: true` before continuing. If the intent is ambiguous, ask whether they want to continue the paused session.
8. In a new conversation, when the user asks to continue or pick up where they left off, call `listStudySessions` with `status=paused` and resume the clear match. Ask the user to choose if there are multiple plausible paused sessions.
9. Update concepts only when there is evidence, such as the user explaining something back, answering correctly, applying a concept, or completing a review.
10. Use concept states to decide review behavior: `new`, `learning`, `review`, `stable`, and `stale`.
11. When the user says to save, log, end the session, finish a topic, complete a review, update the map, or asks what to study next, prefer `recordLearningCheckpoint` to batch session, concept, and evidence updates.
12. Confirm briefly that the checkpoint or session was saved.

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
