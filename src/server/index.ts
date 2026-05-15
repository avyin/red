import "dotenv/config";

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginSession,
  createNote,
  deleteNote,
  getNote,
  getSession,
  initializeDatabase,
  listNotes,
  updateNote
} from "./db.js";
import { buildOpenApiYaml } from "./openapi.js";

const app = express();
const port = Number(process.env.PORT || 3001);

initializeDatabase();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/sessions", (_req, res) => {
  res.status(201).json(beginSession());
});

app.post("/api/notes", (req, res) => {
  const content = readContent(req.body?.content);
  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const source = readOptionalSource(req.body?.source);
  if (source instanceof Error) {
    res.status(400).json({ error: source.message });
    return;
  }

  const sessionId = readOptionalString(req.body?.sessionId, "sessionId");
  if (sessionId instanceof Error) {
    res.status(400).json({ error: sessionId.message });
    return;
  }

  const submittedSessionStartedAt = readOptionalDateTime(
    req.body?.sessionStartedAt,
    "sessionStartedAt"
  );
  if (submittedSessionStartedAt instanceof Error) {
    res.status(400).json({ error: submittedSessionStartedAt.message });
    return;
  }

  let sessionStartedAt = submittedSessionStartedAt;
  if (sessionId) {
    const session = getSession(sessionId);
    if (!session) {
      res.status(400).json({ error: "sessionId was not found" });
      return;
    }

    sessionStartedAt = session.startedAt;
  }

  const note = createNote({ content, source, sessionId, sessionStartedAt });
  res.status(201).json(note);
});

app.get("/api/notes", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(listNotes(search));
});

app.get("/api/notes/:id", (req, res) => {
  const note = getNote(req.params.id);
  if (!note) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  res.json(note);
});

app.patch("/api/notes/:id", (req, res) => {
  const input: { content?: string; source?: string | null } = {};

  if (Object.hasOwn(req.body ?? {}, "content")) {
    const content = readContent(req.body.content);
    if (!content) {
      res.status(400).json({ error: "content must be a non-empty string" });
      return;
    }

    input.content = content;
  }

  if (Object.hasOwn(req.body ?? {}, "source")) {
    const source = readOptionalSource(req.body.source);
    if (source instanceof Error) {
      res.status(400).json({ error: source.message });
      return;
    }

    input.source = source;
  }

  if (input.content === undefined && input.source === undefined) {
    res.status(400).json({ error: "content or source is required" });
    return;
  }

  const note = updateNote(req.params.id, input);
  if (!note) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  res.json(note);
});

app.delete("/api/notes/:id", (req, res) => {
  if (!deleteNote(req.params.id)) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  res.status(204).send();
});

app.get("/openapi.yaml", (_req, res) => {
  res.type("yaml").send(buildOpenApiYaml());
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "../client");
const clientIndex = path.join(clientDir, "index.html");

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
}

function readContent(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const content = value.trim();
  return content.length > 0 ? content : null;
}

function readOptionalSource(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error("source must be a string");
  }

  const source = value.trim();
  return source.length > 0 ? source : null;
}

function readOptionalString(value: unknown, fieldName: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalDateTime(value: unknown, fieldName: string) {
  const dateTime = readOptionalString(value, fieldName);
  if (dateTime instanceof Error || dateTime === null) {
    return dateTime;
  }

  if (Number.isNaN(Date.parse(dateTime))) {
    return new Error(`${fieldName} must be a valid date-time string`);
  }

  return dateTime;
}

const server = app.listen(port, () => {
  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : port;

  console.log(`Learning Log is running on http://localhost:${actualPort}`);
});
