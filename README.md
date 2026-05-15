# Learning Log

A tiny learning journal for plain text notes.

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

Create a note:

```sh
curl -X POST http://localhost:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "The user learned that a process is an isolated running program, while a thread is an execution unit inside a process.",
    "source": "chatgpt"
  }'
```

List notes:

```sh
curl http://localhost:3001/api/notes
```

Search notes:

```sh
curl 'http://localhost:3001/api/notes?search=thread'
```

Get one note:

```sh
curl http://localhost:3001/api/notes/YOUR_NOTE_ID
```

Update a note:

```sh
curl -X PATCH http://localhost:3001/api/notes/YOUR_NOTE_ID \
  -H 'Content-Type: application/json' \
  -d '{"content":"Updated learning note.","source":"chatgpt"}'
```

Delete a note:

```sh
curl -X DELETE http://localhost:3001/api/notes/YOUR_NOTE_ID
```

OpenAPI YAML:

```sh
curl http://localhost:3001/openapi.yaml
```

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
